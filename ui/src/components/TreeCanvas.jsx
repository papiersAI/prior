import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildTreeModel } from "./treeModel.js";

const CARD_W = 232;
const CARD_H = 76;
const ROOT_W = 260;
const ROOT_H = 84;
const X_GAP = 26;
const ROW_GAP = 64;
const PAD_X = 48;
const PAD_TOP = 40; // canvas top padding — keeps the root row clear of the spine
const PAD_BOTTOM = 72;

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// cubic-bezier(0.2, 0, 0, 1) sampled for rAF animations.
function cubicBezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    let low = 0;
    let high = 1;
    let t = x;
    for (let i = 0; i < 24; i += 1) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-4) break;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return sampleY(t);
  };
}
const settle = cubicBezier(0.2, 0, 0, 1);

// Top-down layout: roots spread across the width, children nest beneath parents.
function layoutTree(model) {
  const positions = new Map();
  if (!model.root) return { positions, width: 0, height: 0 };
  let nextX = PAD_X;
  const rowCursor = [];

  function place(id, depth) {
    const children = model.childrenBy.get(id) ?? [];
    const isRoot = depth === 0;
    const w = isRoot ? ROOT_W : CARD_W;
    const h = isRoot ? ROOT_H : CARD_H;
    const y = PAD_TOP + (isRoot ? 0 : ROOT_H + ROW_GAP + (depth - 1) * (CARD_H + ROW_GAP));
    let x;
    if (children.length === 0) {
      x = Math.max(nextX, rowCursor[depth] ?? PAD_X);
      nextX = x + w + X_GAP;
    } else {
      const xs = children.map((child) => place(child.id, depth + 1));
      x = (Math.min(...xs) + Math.max(...xs)) / 2 + (isRoot ? (CARD_W - ROOT_W) / 2 : 0);
      x = Math.max(x, rowCursor[depth] ?? PAD_X);
    }
    rowCursor[depth] = x + w + X_GAP;
    positions.set(id, { x, y, w, h });
    return x;
  }

  place(model.root.id, 0);

  let maxX = 0;
  let maxY = 0;
  for (const pos of positions.values()) {
    maxX = Math.max(maxX, pos.x + pos.w);
    maxY = Math.max(maxY, pos.y + pos.h);
  }
  return { positions, width: maxX + PAD_X, height: maxY + PAD_BOTTOM };
}

// Curved connectors: one cubic bézier per edge, leaving the parent's lower
// edge and entering the child's upper edge. No junction dots.
function edgePath(parent, child) {
  const x1 = parent.x + parent.w / 2;
  const y1 = parent.y + parent.h;
  const x2 = child.x + child.w / 2;
  const y2 = child.y;
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
}

// Two lines at card width ≈ 68 chars; cut on a word boundary so the CSS
// clamp never has to break mid-word.
function clipTitle(text = "", budget = 68) {
  if (text.length <= budget) return text;
  const cut = text.slice(0, budget + 1);
  const at = cut.lastIndexOf(" ");
  return (at > 20 ? cut.slice(0, at) : cut).replace(/[\s,;:.—–-]+$/, "") + "…";
}

function promiseBand(score) {
  if (score == null) return "mid";
  if (score >= 8) return "high";
  if (score >= 6) return "mid";
  return "low";
}

function IdeaCard({ node, pos, active, selected, flash, onSelect }) {
  return (
    <button
      type="button"
      className={`idea-card ${active ? "is-active" : ""} ${selected ? "is-selected" : ""} ${flash ? "is-flash" : ""} ${node.status === "pruned" ? "is-pruned" : ""}`}
      style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
      data-node-id={node.id}
      data-promise={promiseBand(node.score)}
      aria-selected={selected}
      onClick={() => onSelect(node.id)}
    >
      <span className="idea-title">{clipTitle(node.text)}</span>
      {node.score != null && <span className="idea-score">{node.score}/10</span>}
    </button>
  );
}

export default function TreeCanvas({
  nodes,
  question,
  running,
  activeNodeId,
  selected,
  followLive,
  inspectorOpen,
  onSelectNode,
  onOpenBrief,
  onResumeLive,
  onPauseLive,
}) {
  const viewportRef = useRef(null);
  const zoomRef = useRef(1);
  const fitRaf = useRef(0);
  const wasRunning = useRef(running);
  const flashTimer = useRef(0);
  const [zoom, setZoom] = useState(1);
  const [flashId, setFlashId] = useState(null);

  const selectedId = selected?.kind === "node" ? selected.id : null;
  const model = useMemo(() => buildTreeModel(nodes, activeNodeId), [nodes, activeNodeId]);
  const { positions, width, height } = useMemo(() => layoutTree(model), [model]);

  const ideas = model.ideas;
  const finished = !running && ideas.length > 0;
  const ranked = useMemo(
    () =>
      [...ideas]
        .filter((idea) => idea.status !== "pruned" && idea.score != null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6),
    [ideas]
  );

  const edges = [];
  for (const idea of ideas) {
    const parent = model.byId.get(idea.parentId);
    const parentPos = positions.get(parent?.kind === "idea" ? parent.id : model.root?.id);
    const childPos = positions.get(idea.id);
    if (!parentPos || !childPos) continue;
    const alive = running && model.activeIds.has(idea.id);
    edges.push({ id: idea.id, d: edgePath(parentPos, childPos), alive });
  }

  function applyZoom(next) {
    zoomRef.current = next;
    setZoom(next);
  }

  // The viewport is already the remaining region: open sheets shrink the
  // stage (margin/flex), they never draw over it.
  function centerOn(nodeId, behavior = "smooth") {
    const viewport = viewportRef.current;
    const pos = positions.get(nodeId);
    if (!viewport || !pos) return;
    const scale = zoomRef.current;
    const cx = (pos.x + pos.w / 2) * scale;
    const cy = (pos.y + pos.h / 2) * scale;
    viewport.scrollTo({
      left: Math.max(0, cx - viewport.clientWidth / 2),
      top: Math.max(0, cy - viewport.clientHeight / 2),
      behavior,
    });
  }

  // Camera: keep the followed node centered in the remaining viewport.
  const followTarget = followLive ? activeNodeId : selectedId;
  useEffect(() => {
    if (!followTarget) return;
    const raf = requestAnimationFrame(() => centerOn(followTarget));
    return () => cancelAnimationFrame(raf);
  }, [followTarget, inspectorOpen, positions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pinch / ctrl-scroll zooms around the cursor. Plain scroll pans natively.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      onPauseLive?.();
      const previous = zoomRef.current;
      const next = clamp(previous * Math.exp(-event.deltaY * 0.0022), 0.3, 2);
      if (next === previous) return;
      const rect = viewport.getBoundingClientRect();
      const anchorX = event.clientX - rect.left;
      const anchorY = event.clientY - rect.top;
      const worldX = (viewport.scrollLeft + anchorX) / previous;
      const worldY = (viewport.scrollTop + anchorY) / previous;
      applyZoom(next);
      requestAnimationFrame(() => {
        viewport.scrollLeft = worldX * next - anchorX;
        viewport.scrollTop = worldY * next - anchorY;
      });
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [onPauseLive]);

  // Animated fit-to-bounds: 500ms, cubic-bezier(0.2, 0, 0, 1), against the
  // remaining viewport (sheets shrink the stage, they never cover it).
  function animateFit() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    cancelAnimationFrame(fitRaf.current);
    const targetZoom = clamp(
      Math.min((viewport.clientWidth - 48) / width, (viewport.clientHeight - 24) / height, 1),
      0.25,
      1
    );
    const fromZoom = zoomRef.current;
    const fromLeft = viewport.scrollLeft;
    const fromTop = viewport.scrollTop;
    const targetLeft = Math.max(0, (width * targetZoom - viewport.clientWidth) / 2);
    const start = performance.now();
    const tick = (time) => {
      const progress = clamp((time - start) / 500, 0, 1);
      const eased = settle(progress);
      applyZoom(fromZoom + (targetZoom - fromZoom) * eased);
      viewport.scrollLeft = fromLeft + (targetLeft - fromLeft) * eased;
      viewport.scrollTop = fromTop + (0 - fromTop) * eased;
      if (progress < 1) fitRaf.current = requestAnimationFrame(tick);
    };
    fitRaf.current = requestAnimationFrame(tick);
  }

  // Run end: fit the whole tree into the remaining viewport.
  useEffect(() => {
    if (wasRunning.current && !running && ideas.length) animateFit();
    wasRunning.current = running;
    return () => cancelAnimationFrame(fitRaf.current);
  }, [running, ideas.length, width, height]); // eslint-disable-line react-hooks/exhaustive-deps

  // After completion, re-fit when a sheet opens or closes (the stage resizes).
  const wasInspectorOpen = useRef(inspectorOpen);
  useEffect(() => {
    if (finished && wasInspectorOpen.current !== inspectorOpen) animateFit();
    wasInspectorOpen.current = inspectorOpen;
  }, [inspectorOpen, finished]); // eslint-disable-line react-hooks/exhaustive-deps

  function revealNode(id) {
    onSelectNode(id);
    clearTimeout(flashTimer.current);
    setFlashId(id);
    flashTimer.current = setTimeout(() => setFlashId(null), 1600);
    requestAnimationFrame(() => centerOn(id));
  }

  return (
    <section className="idea-map" aria-label="Recursive idea map">
      <div
        ref={viewportRef}
        className="canvas-viewport"
        onPointerDown={onPauseLive}
      >
        <div className="canvas-world" style={{ zoom, width, height }}>
          <svg className="edge-layer" width={width} height={height} aria-hidden="true">
            {edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.d}
                fill="none"
                stroke={edge.alive ? "#C75B2E" : "#D8D4CC"}
                strokeOpacity={edge.alive ? 0.4 : 1}
                strokeWidth="1"
              />
            ))}
          </svg>

          {model.root && positions.get(model.root.id) && (
            <div
              className="root-card"
              style={{
                left: positions.get(model.root.id).x,
                top: positions.get(model.root.id).y,
                width: ROOT_W,
                height: ROOT_H,
              }}
            >
              <span className="idea-title">{model.root.text ?? question}</span>
            </div>
          )}

          {ideas.map((idea) => {
            const pos = positions.get(idea.id);
            if (!pos) return null;
            return (
              <IdeaCard
                key={idea.id}
                node={idea}
                pos={pos}
                active={running && idea.id === activeNodeId}
                selected={idea.id === selectedId}
                flash={idea.id === flashId}
                onSelect={onSelectNode}
              />
            );
          })}
        </div>
      </div>

      {finished && ranked.length > 0 && (
        <aside className="outcome-panel" aria-label="Outcome">
          <div className="shelf-heading">
            <span>Outcome</span>
            <strong>{ranked.length} surviving directions</strong>
          </div>
          <div className="outcome-list">
            {ranked.map((idea) => (
              <button key={idea.id} type="button" onClick={() => revealNode(idea.id)}>
                <span>{idea.text}</span>
                <strong>
                  {idea.initialScore != null && idea.initialScore !== idea.score && (
                    <i>{idea.initialScore} → </i>
                  )}
                  {idea.score}/10
                </strong>
              </button>
            ))}
          </div>
        </aside>
      )}

      {!followLive && running && activeNodeId && (
        <button className="follow-current" type="button" onClick={onResumeLive}>
          Follow current
        </button>
      )}
    </section>
  );
}
