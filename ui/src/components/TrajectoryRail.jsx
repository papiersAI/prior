import React, { useEffect, useMemo, useRef, useState } from "react";

function cleanText(text = "") {
  return text
    .replace(/^\s*[^\w@]+\s*/u, "")
    .replace(/^(unread save|signal|arsenal):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function describeActivity(item, nodes = []) {
  if (!item) return { kind: "event", label: "Activity", text: "" };
  if (item.t === "status") {
    return { kind: "phase", label: item.run === "system" ? "Phase" : "Agent", text: item.text };
  }
  if (item.t === "update") {
    const idea = nodes.find((node) => node.id === item.nodeId);
    const labels = {
      expanding: "Deep dive",
      expanded: "Evaluated",
      pruned: "Pruned",
      frontier: "Frontier",
    };
    const score = item.score == null ? "" : ` · EV ${item.score}`;
    return {
      kind: item.status ?? "update",
      label: labels[item.status] ?? "Updated",
      text: `${idea?.text ?? item.nodeId}${score}`,
    };
  }
  if (item.t === "brief") return { kind: "brief", label: "Artifact", text: "Idea brief ready" };
  if (item.t === "error") return { kind: "error", label: "Run failed", text: item.text ?? "The engine stopped unexpectedly" };
  if (item.t === "done") return { kind: "done", label: "Complete", text: `${item.run} run finished` };
  if (item.t === "metric") {
    return { kind: "metric", label: "Benchmark", text: `${item.run}: ${item.value} ms` };
  }
  if (item.t !== "node") return { kind: item.t, label: "Event", text: item.text ?? item.t };

  const node = item.node;
  if (item.run === "prior") {
    if (node.kind === "query") return { kind: "query", label: "Searching", text: cleanText(node.text) };
    if (node.kind === "direction") return { kind: "candidate", label: "Candidate", text: cleanText(node.text) };
    if (node.kind === "note") return { kind: "signal", label: "Signal", text: cleanText(node.text) };
    if (node.kind === "result" && /^(doc|hl|cnv)_/.test(node.url ?? "")) {
      return { kind: "save", label: "Unread save", text: cleanText(node.text) };
    }
    if (node.kind === "result") return { kind: "evidence", label: "Found", text: cleanText(node.text) };
    return { kind: node.kind, label: "Scout", text: cleanText(node.text) };
  }

  const labels = {
    root: "Objective",
    seed: "Seed selected",
    idea: "Idea added",
    evidence: "Evidence",
    eval: "Evaluation",
  };
  return { kind: node.kind, label: labels[node.kind] ?? "Tree", text: cleanText(node.text) };
}

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
  const heading = showingValidated ? "High signal" : showingFrontier ? "Leading frontier" : "Working set";
  const total = showingValidated ? validated.length : showingFrontier ? leadingFrontier.length : candidates.length;
  const description = showingValidated
    ? "Validated after deep dive"
    : showingFrontier
      ? "High-EV ideas awaiting evaluation"
      : "Candidate directions under consideration";

  return (
    <section className="working-set" aria-label={showingValidated ? "High signal ideas" : "Agent working set"}>
      <div className="rail-section-heading">
        <div>
          <span>{heading}</span>
          <strong>{total}</strong>
        </div>
        <p>{description}</p>
      </div>
      <div className="working-set-items">
        {items.length === 0 ? (
          <p className="working-set-empty">No candidate directions yet.</p>
        ) : (
          items.map((item) => {
            if (showingValidated || showingFrontier) {
              return (
                <button key={item.id} type="button" onClick={() => onSelectNode(item.id)}>
                  <span>{item.text}</span>
                  <strong>{showingValidated ? `EV ${item.score}` : `Frontier ${item.score}`}</strong>
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
          })
        )}
      </div>
    </section>
  );
}

export default function TrajectoryRail({ activity, nodes, running, selected, onSelect, onSelectNode }) {
  const scroller = useRef(null);
  const [following, setFollowing] = useState(true);
  const visible = useMemo(
    () => activity.filter((item) => item.t !== "prior" && item.t !== "divergence"),
    [activity]
  );

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
    <aside className="trajectory-rail">
      <WorkingSet
        activity={visible}
        nodes={nodes}
        onSelect={onSelect}
        onSelectNode={onSelectNode}
      />
      <section className="trace-section">
        <div className="rail-section-heading trace-heading">
          <div>
            <span>Trajectory</span>
            <strong>{visible.length}</strong>
          </div>
          <p>{running ? "Live agent trace" : "Complete emitted trace"}</p>
        </div>
        <div ref={scroller} className="trace-list" onScroll={handleScroll}>
          {visible.length === 0 ? (
            <div className="trace-empty">
              <span aria-hidden="true" />
              <p>No agent activity yet.</p>
            </div>
          ) : (
            visible.map((item, index) => {
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
            })
          )}
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
            Return to live activity
          </button>
        )}
      </section>
    </aside>
  );
}
