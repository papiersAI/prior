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
