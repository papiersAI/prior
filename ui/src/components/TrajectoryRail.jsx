import React, { useEffect, useMemo, useRef, useState } from "react";
import { describeActivity } from "./activityModel.js";
import useModalFocus from "./useModalFocus.js";

function WorkingSet({ activity, nodes, onSelect, onSelectNode }) {
  const validated = nodes
    .filter((node) => node.kind === "idea" && node.score >= 8 && node.status === "expanded")
    .sort((a, b) => b.score - a.score);
  const leadingFrontier = nodes
    .filter((node) => node.kind === "idea" && node.score >= 8 && node.status !== "expanded" && node.status !== "pruned")
    .sort((a, b) => b.score - a.score);
  const candidates = activity.filter(
    (item) => item.t === "node" && item.run === "prior" && item.node.kind === "direction"
  );

  const showingValidated = validated.length > 0;
  const showingFrontier = !showingValidated && leadingFrontier.length > 0;
  const items = showingValidated
    ? validated.slice(0, 3)
    : showingFrontier
      ? leadingFrontier.slice(0, 3)
      : candidates.slice(-3).reverse();
  const heading = showingValidated ? "High signal" : showingFrontier ? "Frontier" : "Considering";
  const total = showingValidated ? validated.length : showingFrontier ? leadingFrontier.length : candidates.length;

  if (items.length === 0) return null;

  return (
    <section className="working-set" aria-label={showingValidated ? "High signal ideas" : "Agent working set"}>
      <div className="rail-section-heading">
        <span>{heading}</span>
        <strong>{total}</strong>
      </div>
      <div className="working-set-items">
        {items.map((item) => {
          if (showingValidated || showingFrontier) {
            return (
              <button key={item.id} type="button" onClick={() => onSelectNode(item.id)}>
                <span>{item.text}</span>
                <strong>{item.score}/10</strong>
              </button>
            );
          }
          const description = describeActivity(item, nodes);
          return (
            <button key={item._key} type="button" onClick={() => onSelect(item)}>
              <span>{description.text}</span>
              <strong>Candidate</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function TrajectoryRail({ activity, nodes, running, selected, onClose, onSelect, onSelectNode }) {
  const scroller = useRef(null);
  const railRef = useRef(null);
  const closeRef = useRef(null);
  const [following, setFollowing] = useState(true);
  const visible = useMemo(
    () => activity.filter((item) => item.t !== "prior" && item.t !== "divergence"),
    [activity]
  );
  useModalFocus({ open: true, containerRef: railRef, initialRef: closeRef, onClose });

  useEffect(() => {
    if (!following) return;
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [visible.length, following]);

  function handleScroll() {
    const element = scroller.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    setFollowing(distance < 56);
  }

  return (
    <aside ref={railRef} className="trajectory-rail" role="dialog" aria-modal="true" aria-label="Agent activity" tabIndex={-1}>
      <header className="activity-header">
        <div>
          <strong>Journal</strong>
          {running && <i aria-label="Live" />}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close journal" title="Close">×</button>
      </header>
      <WorkingSet
        activity={visible}
        nodes={nodes}
        onSelect={onSelect}
        onSelectNode={onSelectNode}
      />
      <section className="trace-section">
        <div ref={scroller} className="trace-list" onScroll={handleScroll}>
          {visible.map((item, index) => {
            const description = describeActivity(item, nodes);
            const isSelected = selected?.kind === "activity" && selected.item._key === item._key;
            return (
              <button
                key={item._key}
                type="button"
                className={`trace-row ${isSelected ? "is-selected" : ""}`}
                data-trace-kind={description.kind}
                onClick={() => onSelect(item)}
              >
                <span className="trace-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="trace-copy">
                  <strong>{description.label}</strong>
                  <span>{description.text}</span>
                </span>
                <span className="trace-marker" aria-hidden="true" />
              </button>
            );
          })}
        </div>
        {!following && visible.length > 0 && (
          <button
            type="button"
            className="resume-trace"
            onClick={() => {
              setFollowing(true);
              requestAnimationFrame(() => {
                if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
              });
            }}
          >
            Jump to latest
          </button>
        )}
      </section>
    </aside>
  );
}
