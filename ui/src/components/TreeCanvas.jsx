import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildTreeModel } from "./treeModel.js";

function compactSourceTitle(text = "") {
  return text.replace(/^\s*[^\w@]+\s*/u, "").replace(/^unread save:\s*/i, "").split("\n")[0].trim();
}

function IdeaNode({ node, childrenCount, active, onPath, selected, onSelect, register }) {
  const highSignal = node.score >= 8 && node.status === "expanded";
  const stateLabel = node.status === "expanding"
    ? "Evaluating"
    : node.status === "pruned"
      ? "Pruned"
        : node.status === "expanded"
          ? "Evaluated"
          : "Frontier";

  return (
    <button
      ref={register}
      type="button"
      className={`idea-node ${active ? "is-active" : ""} ${onPath ? "is-on-path" : ""} ${selected ? "is-selected" : ""}`}
      data-node-id={node.id}
      data-kind="idea"
      data-status={node.status ?? "frontier"}
      data-signal={highSignal ? "high" : undefined}
      aria-selected={selected}
      onClick={() => onSelect(node.id)}
    >
      <span className="idea-joint" aria-hidden="true" />
      <span className="idea-copy">
        <span className="idea-eyebrow">
          <span>Depth {node.derivedDepth}</span>
          {childrenCount > 0 && <span>{childrenCount} branches</span>}
        </span>
        <strong>{node.text}</strong>
        <span className="idea-meta">
          {node.score != null && <b>EV {node.score}</b>}
          {stateLabel && <span>{stateLabel}</span>}
          {highSignal && <span className="signal-label">High signal</span>}
        </span>
      </span>
    </button>
  );
}

function IdeaBranch({ node, model, activeNodeId, selectedId, onSelectNode, registerNode }) {
  const children = model.childrenBy.get(node.id) ?? [];
  const onPath = model.activeIds.has(node.id);

  return (
    <div className="idea-branch">
      <div className={`branch-node ${children.length ? "has-children" : ""} ${onPath ? "is-on-path" : ""}`}>
        <IdeaNode
          node={node}
          childrenCount={children.length}
          active={node.id === activeNodeId}
          onPath={onPath}
          selected={node.id === selectedId}
          onSelect={onSelectNode}
          register={(element) => registerNode(node.id, element)}
        />
      </div>
      {children.length > 0 && (
        <div className="branch-children">
          {children.map((child) => (
            <div
              key={child.id}
              className="branch-child"
              data-edge-active={model.activeIds.has(child.id) ? "true" : "false"}
              data-edge-pruned={child.status === "pruned" ? "true" : "false"}
            >
              <IdeaBranch
                node={child}
                model={model}
                activeNodeId={activeNodeId}
                selectedId={selectedId}
                onSelectNode={onSelectNode}
                registerNode={registerNode}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceShelf({ sources, totalUnread, selected, onSelectSource }) {
  return (
    <section className="source-shelf" aria-label="Selected library seeds">
      <div className="source-shelf-heading">
        <span>Personal prior</span>
        <strong>{sources.length}</strong>
      </div>
      <p>{sources.length ? `${sources.length} selected from ${totalUnread.toLocaleString()} unread saves` : `Scanning ${totalUnread.toLocaleString()} unread saves`}</p>
      <div className="source-list">
        {sources.map((source, index) => (
          <button
            key={source.id}
            type="button"
            className={selected?.kind === "source" && selected.node.id === source.id ? "is-selected" : ""}
            onClick={() => onSelectSource(source)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{compactSourceTitle(source.text)}</strong>
          </button>
        ))}
        {sources.length === 0 && (
          <div className="source-loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyCanvas({ question, onRun }) {
  return (
    <div className="tree-empty-state">
      <div className="empty-origin">
        <span>3,256 items</span>
        <strong>3,224 unread saves</strong>
        <p>Your curation is an unexploited prior over idea space.</p>
      </div>
      <span className="empty-line" aria-hidden="true" />
      <div className="empty-objective">
        <span>Ready objective</span>
        <strong>{question}</strong>
        <button type="button" onClick={onRun}>Run exploration</button>
      </div>
    </div>
  );
}

export default function TreeCanvas({
  nodes,
  scoutNodes,
  question,
  running,
  activeNodeId,
  selected,
  followLive,
  onSelectNode,
  onSelectSource,
  onRun,
  onResumeLive,
  onPauseLive,
}) {
  const scroller = useRef(null);
  const contentRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const wasRunning = useRef(running);
  const [zoom, setZoom] = useState(1);
  const selectedId = selected?.kind === "node" ? selected.id : null;
  const pathFocusId = activeNodeId ?? selectedId;
  const model = useMemo(() => buildTreeModel(nodes, pathFocusId), [nodes, pathFocusId]);
  const scoutSeeds = scoutNodes.filter(
    (node) => node.kind === "result" && /^(doc|hl|cnv)_/.test(node.url ?? "")
  );
  const sourceByReceipt = new Map(scoutSeeds.map((node) => [node.url ?? node.id, node]));
  for (const seed of model.seeds) sourceByReceipt.set(seed.url ?? seed.id, seed);
  const sources = [...sourceByReceipt.values()];

  useEffect(() => {
    if (!activeNodeId || !followLive) return;
    nodeRefs.current.get(activeNodeId)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [activeNodeId, followLive]);

  useEffect(() => {
    if (wasRunning.current && !running && model.ideas.length) {
      requestAnimationFrame(() => fitMap());
    }
    wasRunning.current = running;
  }, [running, model.ideas.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function registerNode(id, element) {
    if (element) nodeRefs.current.set(id, element);
    else nodeRefs.current.delete(id);
  }

  function fitMap() {
    const viewport = scroller.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const availableWidth = Math.max(1, viewport.clientWidth - 24);
    const availableHeight = Math.max(1, viewport.clientHeight - 24);
    const naturalWidth = content.offsetWidth;
    const naturalHeight = content.offsetHeight;
    const next = Math.max(0.4, Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight));
    setZoom(Math.round(next * 20) / 20);
    requestAnimationFrame(() => viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" }));
  }

  function changeZoom(delta) {
    onPauseLive?.();
    setZoom((current) => Math.max(0.4, Math.min(1.4, Math.round((current + delta) * 10) / 10)));
  }

  if (!model.root && !running) return <EmptyCanvas question={question} onRun={onRun} />;

  return (
    <section className="idea-map" aria-label="Recursive idea map">
      <header className="map-header">
        <div className="map-heading">
          <span>Idea map</span>
          <strong>{model.ideas.length ? `${model.ideas.length} ideas across ${model.maxDepth} depths` : "Building the seed set"}</strong>
        </div>
        <div className="map-controls">
          <button type="button" onClick={() => changeZoom(-0.1)} aria-label="Zoom out" title="Zoom out">−</button>
          <span className="zoom-value" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(0.1)} aria-label="Zoom in" title="Zoom in">+</button>
          <button type="button" onClick={fitMap}>Fit</button>
          {!followLive && activeNodeId && (
            <button type="button" onClick={onResumeLive}>Follow current</button>
          )}
        </div>
      </header>
      <div ref={scroller} className="map-scroller" onWheel={onPauseLive} onPointerDown={onPauseLive}>
        <div ref={contentRef} className="map-content" style={{ zoom }}>
          <SourceShelf
            sources={sources}
            totalUnread={3224}
            selected={selected}
            onSelectSource={onSelectSource}
          />
          <span className={`source-connector ${sources.length ? "has-sources" : ""}`} aria-hidden="true" />
          <div className={`objective-node ${model.activeIds.size ? "has-active-path" : ""}`} data-kind="root" data-node-id={model.root?.id}>
            <span>Objective</span>
            <strong>{model.root?.text ?? question}</strong>
            <small>{model.rootIdeas.length ? `${model.rootIdeas.length} root directions` : "Waiting for the scout"}</small>
          </div>
          {model.rootIdeas.length > 0 && (
            <div className="root-branches">
              {model.rootIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="root-child"
                  data-edge-active={model.activeIds.has(idea.id) ? "true" : "false"}
                >
                  <IdeaBranch
                    node={idea}
                    model={model}
                    activeNodeId={activeNodeId}
                    selectedId={selectedId}
                    onSelectNode={onSelectNode}
                    registerNode={registerNode}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
