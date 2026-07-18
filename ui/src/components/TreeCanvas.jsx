import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReceiptChip from "./ReceiptChip.jsx";

const ROOT_KEY = "__rootgroup";

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function ScoreChip({ score, pruned }) {
  if (score == null) return null;
  const hot = score >= 8 && !pruned;
  return (
    <span
      className={`shrink-0 font-mono tabular-nums text-[10px] leading-none px-1.5 py-[3px] rounded-sm border
        ${hot ? "border-accent/40 text-accent" : "border-white/15 text-white/45"}
        ${pruned ? "line-through decoration-white/40" : ""}`}
    >
      ev {score}
    </span>
  );
}

function SeedChip({ node, onReceiptClick }) {
  return (
    <button
      onClick={() => onReceiptClick?.({ ref: node.url, quote: node.text })}
      title={`${node.text}\n${node.url ?? ""}`}
      className="node-in flex items-center gap-1.5 rounded-sm border border-white/10 bg-white/[0.02]
                 px-2 py-1 text-[10px] text-white/40 hover:text-white/70 hover:border-white/20
                 transition-colors cursor-pointer"
    >
      <span className="opacity-70">📚</span>
      <span className="max-w-[150px] truncate">{node.text}</span>
      {node.url && (
        <span className="font-mono text-[9px] text-white/25">{node.url.slice(0, 8)}…</span>
      )}
    </button>
  );
}

function EvidenceList({ items }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const collapsed = items.length > 2 && !open;
  const toggle = (e) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };
  return (
    <div className="mt-2 border-t border-white/[0.06] pt-1.5">
      {items.length > 2 && (
        <button
          onClick={toggle}
          className="block text-[10px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
        >
          {collapsed ? "▸" : "▾"} {items.length} sources
        </button>
      )}
      {!collapsed &&
        items.map((ev) => {
          const domain = ev.url ? domainOf(ev.url) : null;
          return (
            <a
              key={ev.id}
              href={ev.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="node-in block truncate text-[10px] leading-[1.7] text-white/35
                         hover:text-white/60 transition-colors"
              title={ev.text}
            >
              <span className="text-white/20 mr-1">↳</span>
              {ev.text}
              {domain && <span className="font-mono text-white/20 ml-1.5">{domain}</span>}
            </a>
          );
        })}
    </div>
  );
}

function IdeaCard({ node, evidence, evals, onReceiptClick, registerRef }) {
  const [expanded, setExpanded] = useState(false);
  const pruned = node.status === "pruned";
  const border =
    node.status === "expanding"
      ? "tree-pulse border-accent/40"
      : node.status === "expanded"
        ? "border-white/25"
        : "border-white/10";
  return (
    <div
      ref={registerRef}
      onClick={() => setExpanded((v) => !v)}
      className={`node-in w-[260px] shrink-0 cursor-pointer rounded-sm border ${border}
                  bg-white/[0.02] px-3 py-2.5 text-left transition-[opacity,border-color]
                  duration-500 ${pruned ? "opacity-30" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-medium leading-snug text-white/90">{node.text}</span>
        <ScoreChip score={node.score} pruned={pruned} />
      </div>
      {node.detail && (
        <div
          className={`mt-1 text-[11px] leading-relaxed text-white/45 ${expanded ? "" : "truncate"}`}
        >
          {node.detail}
        </div>
      )}
      {node.receipts?.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {node.receipts.map((r, i) => (
            <ReceiptChip key={i} receipt={r} onClick={onReceiptClick} />
          ))}
        </div>
      )}
      <EvidenceList items={evidence} />
      {evals.map((ev) => (
        <div
          key={ev.id}
          className={`node-in mt-1.5 text-[11px] italic leading-relaxed text-white/40
                      ${expanded ? "" : "line-clamp-2"}`}
        >
          {ev.text}
          {expanded && ev.detail && (
            <span className="not-italic text-white/30"> — risks: {ev.detail}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function TreeCanvas({ nodes, onReceiptClick }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const cardRefs = useRef(new Map()); // ROOT_KEY | idea id → element
  const [edges, setEdges] = useState([]); // {key, x1,y1,x2,y2, active}
  const [size, setSize] = useState({ w: 0, h: 0 });

  const derived = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const root = nodes.find((n) => n.kind === "root") ?? null;
    const seeds = nodes.filter((n) => n.kind === "seed");
    const ideas = nodes.filter((n) => n.kind === "idea");
    const evidenceBy = new Map();
    const evalsBy = new Map();
    for (const n of nodes) {
      if (n.kind === "evidence") {
        if (!evidenceBy.has(n.parentId)) evidenceBy.set(n.parentId, []);
        evidenceBy.get(n.parentId).push(n);
      } else if (n.kind === "eval") {
        if (!evalsBy.has(n.parentId)) evalsBy.set(n.parentId, []);
        evalsBy.get(n.parentId).push(n);
      }
    }
    const rows = []; // depth → ideas (arrival order)
    for (const n of ideas) {
      const d = Math.max(1, n.depth ?? 1);
      (rows[d] ??= []).push(n);
    }
    // amber path: root → the currently expanding node
    const expanding = [...ideas].reverse().find((n) => n.status === "expanding") ?? null;
    const activeIds = new Set();
    for (let cur = expanding; cur; cur = byId.get(cur.parentId)) activeIds.add(cur.id);
    const structural = [];
    for (const n of ideas) {
      const parent = byId.get(n.parentId);
      const from = parent && parent.kind === "idea" ? parent.id : ROOT_KEY;
      structural.push({ from, to: n.id, active: activeIds.has(n.id) });
    }
    return { root, seeds, rows, evidenceBy, evalsBy, structural, expandingId: expanding?.id ?? null };
  }, [nodes]);

  /* measure card anchor points → SVG edges (coords relative to the inner canvas) */
  useLayoutEffect(() => {
    const measure = () => {
      const inner = innerRef.current;
      if (!inner) return;
      const ib = inner.getBoundingClientRect();
      const anchor = (key) => {
        const el = cardRefs.current.get(key);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          cx: r.left + r.width / 2 - ib.left,
          top: r.top - ib.top,
          bottom: r.bottom - ib.top,
        };
      };
      const next = [];
      for (const e of derived.structural) {
        const p = anchor(e.from);
        const c = anchor(e.to);
        if (!p || !c) continue;
        next.push({ key: e.to, x1: p.cx, y1: p.bottom + 2, x2: c.cx, y2: c.top - 2, active: e.active });
      }
      setEdges(next);
      setSize({ w: inner.scrollWidth, h: inner.scrollHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [derived.structural]);

  /* keep the newest activity gently in view */
  useEffect(() => {
    const last = [...nodes].reverse().find((n) => n.kind === "idea");
    if (!last) return;
    cardRefs.current
      .get(last.id)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [nodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!derived.expandingId) return;
    cardRefs.current
      .get(derived.expandingId)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [derived.expandingId]);

  const register = (key) => (el) => {
    if (el) cardRefs.current.set(key, el);
    else cardRefs.current.delete(key);
  };

  return (
    <div ref={outerRef} className="h-full overflow-auto">
      <div ref={innerRef} className="relative w-max min-w-full px-10 py-8">
        {/* edges */}
        <svg
          className="absolute left-0 top-0 pointer-events-none"
          width={size.w}
          height={size.h}
          aria-hidden="true"
        >
          {edges.map((e) => {
            const midY = (e.y1 + e.y2) / 2;
            const d = `M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`;
            return (
              <path
                key={e.key}
                d={d}
                fill="none"
                stroke={e.active ? "rgba(240,176,63,0.55)" : "rgba(255,255,255,0.15)"}
                strokeWidth={e.active ? 1.5 : 1}
              />
            );
          })}
        </svg>

        {/* root group: objective card + seed cluster */}
        <div ref={register(ROOT_KEY)} className="relative mx-auto w-max max-w-full">
          {derived.root && (
            <div
              className="node-in mx-auto max-w-[560px] rounded-sm border border-white/15
                         bg-white/[0.03] px-5 py-3.5 text-center"
            >
              <div className="text-[9px] uppercase tracking-[0.3em] text-white/30 mb-1">
                objective
              </div>
              <div className="text-[13.5px] font-medium leading-snug text-white/90">
                {derived.root.text}
              </div>
            </div>
          )}
          {derived.seeds.length > 0 && (
            <div className="mt-3 flex max-w-[860px] mx-auto flex-wrap justify-center gap-1.5">
              {derived.seeds.map((s) => (
                <SeedChip key={s.id} node={s} onReceiptClick={onReceiptClick} />
              ))}
            </div>
          )}
        </div>

        {/* idea rows, by depth */}
        {derived.rows.map(
          (row, depth) =>
            row && (
              <div key={depth} className="relative mt-16 flex items-start justify-center gap-8">
                {row.map((n) => (
                  <IdeaCard
                    key={n.id}
                    node={n}
                    evidence={derived.evidenceBy.get(n.id) ?? []}
                    evals={derived.evalsBy.get(n.id) ?? []}
                    onReceiptClick={onReceiptClick}
                    registerRef={register(n.id)}
                  />
                ))}
              </div>
            )
        )}
      </div>
    </div>
  );
}
