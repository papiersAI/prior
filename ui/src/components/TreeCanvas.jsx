import React, { useEffect, useMemo, useRef, useState } from "react";
import SourceCard from "./SourceCard.jsx";
import { buildTreeModel } from "./treeModel.js";

function IdeaNode({ node, active, onPath, selected, onSelect, register }) {
  const highSignal = node.score >= 8 && node.status === "expanded";

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
        <strong>{node.text}</strong>
        <span className="idea-meta">
          {node.score != null && <b>EV {node.score}</b>}
          {node.status === "expanding" && <span>Evaluating</span>}
          {node.status === "pruned" && <span>Pruned</span>}
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

function SourceShelf({ sources, heading, summary, selected, onSelectSource }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? sources : sources.slice(0, 5);
  const remaining = sources.length - visible.length;

  return (
    <section className="source-shelf" aria-label="Sources selected from your library">
      <div className="source-shelf-heading">
        <span>{heading}</span>
        <strong>{summary}</strong>
      </div>
      <div className="source-list">
        {visible.map((source) => (
          <SourceCard
            key={source.id}
            source={{
              ref: source.ref ?? source.url ?? source.id,
              text: source.text,
              annotation: source.annotation,
            }}
            selected={selected?.kind === "source" && selected.node.id === (source.node ?? source).id}
            onOpen={() => onSelectSource(source.node ?? source)}
          />
        ))}
        {remaining > 0 && (
          <button className="more-sources" type="button" onClick={() => setExpanded(true)}>
            <strong>+{remaining}</strong>
            <span>more sources</span>
          </button>
        )}
        {expanded && sources.length > 5 && (
          <button className="less-sources" type="button" onClick={() => setExpanded(false)}>
            Show less
          </button>
        )}
      </div>
    </section>
  );
}

function EmptyCanvas({ question, onRun }) {
  return (
    <div className="tree-empty-state">
      <div className="empty-origin">
        <strong>3,224 saves you never opened.</strong>
        <span>Put them to work on</span>
        <p>{question}</p>
        <button type="button" onClick={onRun}>Explore my library</button>
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
  const scoutSources = scoutNodes.filter((node) => node.kind === "result" && node.url);
  const sourceByReceipt = new Map(scoutSources.map((node) => [node.url, node]));
  for (const seed of model.seeds) sourceByReceipt.set(seed.url ?? seed.id, seed);
  const librarySources = [...sourceByReceipt.entries()]
    .filter(([ref]) => /^(doc|hl|cnv)_/.test(ref))
    .map(([, source]) => source);
  const focusedNode = model.byId.get(activeNodeId ?? selectedId);
  const focusedEvidence = focusedNode ? model.evidenceBy.get(focusedNode.id) ?? [] : [];
  const focusedSources = [];
  const focusedRefs = new Set();

  for (const [index, receipt] of (focusedNode?.receipts ?? []).entries()) {
    if (focusedRefs.has(receipt.ref)) continue;
    focusedRefs.add(receipt.ref);
    const matched = sourceByReceipt.get(receipt.ref);
    const sourceNode = matched ?? {
      id: `receipt-${focusedNode.id}-${index}`,
      kind: "seed",
      url: receipt.ref,
      text: receipt.quote ?? receipt.ref,
    };
    focusedSources.push({
      id: `receipt-${focusedNode.id}-${index}`,
      ref: receipt.ref,
      text: matched?.text ?? receipt.quote ?? receipt.ref,
      annotation: receipt.quote,
      node: sourceNode,
    });
  }

  for (const evidence of focusedEvidence) {
    const ref = evidence.url ?? evidence.text;
    if (focusedRefs.has(ref)) continue;
    focusedRefs.add(ref);
    focusedSources.push({
      id: evidence.id,
      ref,
      text: evidence.text,
      annotation: evidence.detail,
      node: evidence,
    });
  }

  const sources = focusedSources.length ? focusedSources : librarySources;
  const sourceHeading = focusedSources.length ? "Evidence in play" : "From your library";
  const sourceSummary = focusedSources.length
    ? `${focusedSources.length} sources for this direction`
    : `${librarySources.length} of 3,224 unread`;

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
      <div className="map-controls">
        <button type="button" onClick={() => changeZoom(-0.1)} aria-label="Zoom out" title="Zoom out">−</button>
        <span className="zoom-value" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => changeZoom(0.1)} aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" onClick={fitMap}>Fit</button>
        {!followLive && activeNodeId && (
          <button type="button" onClick={onResumeLive}>Follow current</button>
        )}
      </div>
      <div ref={scroller} className="map-scroller" onWheel={onPauseLive} onPointerDown={onPauseLive}>
        <div ref={contentRef} className="map-content" style={{ zoom }}>
          {sources.length > 0 && (
            <>
              <SourceShelf
                sources={sources}
                heading={sourceHeading}
                summary={sourceSummary}
                selected={selected}
                onSelectSource={onSelectSource}
              />
              <span className="source-thread" aria-hidden="true" />
            </>
          )}
          <div className="tree-flow">
            <div className={`objective-node ${model.activeIds.size ? "has-active-path" : ""}`} data-kind="root" data-node-id={model.root?.id}>
              <strong>{model.root?.text ?? question}</strong>
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
      </div>
    </section>
  );
}
