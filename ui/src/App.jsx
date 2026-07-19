import React, { useEffect, useRef, useState } from "react";
import BriefOverlay from "./components/BriefOverlay.jsx";
import Column from "./components/Column.jsx";
import InspectorPane from "./components/InspectorPane.jsx";
import PriorPane from "./components/PriorPane.jsx";
import TrajectoryRail from "./components/TrajectoryRail.jsx";
import TreeCanvas from "./components/TreeCanvas.jsx";

const SERVER = import.meta.env.VITE_PRIOR_SERVER ?? "http://localhost:8787";
const PARAMS = new URLSearchParams(window.location.search);
const FIXTURE = PARAMS.get("fixture");
const MODE = PARAMS.get("mode") === "pursue" ? "pursue" : "explore";
const TREEISH = FIXTURE ? FIXTURE === "tree" || FIXTURE === "tree-synthetic" : MODE === "explore";

const FIXTURE_QUESTION =
  "What should a 2-person team build to inject human research taste into autoresearch loops?";
const KERNEL_QUESTION = "Make naive numpy attention as fast as possible on CPU";
const TREE_QUESTION = "GPU MODE — batched dense Cholesky (leaderboard 776)";

const fmtSpeedup = (s) => (s >= 10 ? String(Math.round(s)) : s.toFixed(1));

function useTween(target, ms = 600) {
  const [value, setValue] = useState(target);
  const raf = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = value;
    const start = performance.now();
    const tick = (time) => {
      const progress = Math.min(1, (time - start) / ms);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return value;
}

function phaseFor({ running, brief, treeNodes, scoutNodes, activeNodeId, error }) {
  if (error) return "Run interrupted";
  if (brief) return "Exploration complete";
  if (!running) return "Ready to explore";

  const active = treeNodes.find((node) => node.id === activeNodeId);
  if (active) return `Deepening: ${active.text}`;
  if (treeNodes.some((node) => node.kind === "idea")) return "Growing the idea tree";
  if (scoutNodes.some((node) => node.kind === "direction")) return "Distilling candidate directions";
  if (scoutNodes.length) return "Scouting the library and adjacent evidence";
  return "Starting exploration";
}

export default function App() {
  const [nodes, setNodes] = useState({ vanilla: [], prior: [] });
  const [treeNodes, setTreeNodes] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [selection, setSelection] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [divergence, setDivergence] = useState(0);
  const [priorMd, setPriorMd] = useState("");
  const [priorReceipt, setPriorReceipt] = useState(null);
  const [done, setDone] = useState({ vanilla: false, prior: false });
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [paneOpen, setPaneOpen] = useState(false);
  const [followingLive, setFollowingLive] = useState(true);
  const [runError, setRunError] = useState("");
  const [question, setQuestion] = useState(
    FIXTURE === "kernel" ? KERNEL_QUESTION : FIXTURE === "default" ? FIXTURE_QUESTION : TREE_QUESTION
  );
  const [metrics, setMetrics] = useState({ vanilla: [], prior: [] });

  const depthRef = useRef({});
  const priorApi = useRef(null);
  const eventSequence = useRef(0);
  const selectionPinned = useRef(false);

  useEffect(() => {
    const eventSource = new EventSource(`${SERVER}/events`);
    eventSource.onopen = () => setConnected(true);
    eventSource.onerror = () => setConnected(false);
    eventSource.onmessage = (message) => {
      let event;
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }

      if (event.t !== "prior") {
        const traced = { ...event, _key: `event-${eventSequence.current++}`, _at: Date.now() };
        setActivity((current) => [...current, traced]);
      }

      if (event.t === "node") {
        if (event.run === "tree") {
          const scoreHistory = event.node.score == null ? [] : [event.node.score];
          const statusHistory = event.node.status ? [event.node.status] : [];
          const scoreCheckpoints = event.node.score == null
            ? []
            : [{ score: event.node.score, status: event.node.status ?? "frontier", stage: "generated" }];
          setTreeNodes((current) => [
            ...current,
            { ...event.node, initialScore: event.node.score, scoreHistory, statusHistory, scoreCheckpoints },
          ]);
        } else {
          const node = event.node;
          const depth = node.parentId ? (depthRef.current[node.parentId] ?? 0) + 1 : 0;
          depthRef.current[node.id] = depth;
          setNodes((current) => ({
            ...current,
            [event.run]: [...current[event.run], { ...node, depth, step: event.step }],
          }));
        }
      } else if (event.t === "update") {
        setTreeNodes((current) =>
          current.map((node) => {
            if (node.id !== event.nodeId) return node;
            const score = event.score ?? node.score;
            const statusValue = event.status ?? node.status;
            const scoreHistory =
              event.score != null && node.scoreHistory?.at(-1) !== event.score
                ? [...(node.scoreHistory ?? []), event.score]
                : node.scoreHistory ?? [];
            const statusHistory =
              event.status && node.statusHistory?.at(-1) !== event.status
                ? [...(node.statusHistory ?? []), event.status]
                : node.statusHistory ?? [];
            const scoreCheckpoints = event.score != null || event.status
              ? [
                  ...(node.scoreCheckpoints ?? []),
                  {
                    score,
                    status: statusValue,
                    stage: event.status === "expanding" ? "deep-dive" : event.status === "pruned" ? "pruned" : event.status === "expanded" ? "evaluated" : "updated",
                  },
                ]
              : node.scoreCheckpoints ?? [];
            return { ...node, score, status: statusValue, scoreHistory, statusHistory, scoreCheckpoints };
          })
        );
        if (event.status === "expanding") {
          setActiveNodeId(event.nodeId);
          if (!selectionPinned.current) setSelection({ kind: "node", id: event.nodeId });
        } else if (event.status === "expanded" || event.status === "pruned") {
          setActiveNodeId((current) => (current === event.nodeId ? null : current));
        }
      } else if (event.t === "brief") {
        setBrief(event.markdown);
        setRunning(false);
      } else if (event.t === "divergence") {
        setDivergence(event.value);
      } else if (event.t === "metric") {
        setMetrics((current) => ({
          ...current,
          [event.run]: [...(current[event.run] ?? []), { iter: event.iter, value: event.value }],
        }));
      } else if (event.t === "error") {
        setRunning(false);
        setActiveNodeId(null);
        setRunError(event.text ?? "Run failed");
      } else if (event.t === "prior") {
        setPriorMd(event.markdown);
      } else if (event.t === "done") {
        setDone((current) => {
          const next = { ...current, [event.run]: true };
          if (next.vanilla && next.prior) setRunning(false);
          return next;
        });
      }
    };
    return () => eventSource.close();
  }, []);

  async function run() {
    if (running) {
      await fetch(`${SERVER}/api/stop`, { method: "POST" }).catch(() => {});
      setRunning(false);
      setActiveNodeId(null);
      return;
    }

    depthRef.current = {};
    eventSequence.current = 0;
    selectionPinned.current = false;
    setFollowingLive(true);
    setNodes({ vanilla: [], prior: [] });
    setTreeNodes([]);
    setActivity([]);
    setActiveNodeId(null);
    setSelection(null);
    setBrief(null);
    setBriefOpen(false);
    setActivityOpen(false);
    setDone({ vanilla: false, prior: false });
    setDivergence(0);
    setMetrics({ vanilla: [], prior: [] });
    setRunError("");
    setRunning(true);

    const runUrl = FIXTURE
      ? `${SERVER}/api/run?fixture=${encodeURIComponent(FIXTURE)}`
      : `${SERVER}/api/run`;
    const response = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, mode: MODE }),
    }).catch(() => null);

    if (!response) {
      const message = "Server unreachable. Start the prior server and try again.";
      setRunning(false);
      setRunError(message);
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body.error ?? `Run failed (${response.status})`;
      setRunning(false);
      setRunError(message);
    }
  }

  function openPrior(receipt = null) {
    setActivityOpen(false);
    setPriorReceipt(receipt);
    setPaneOpen(true);
    if (receipt) setTimeout(() => priorApi.current?.jumpTo(receipt), 80);
  }

  function selectNode(id) {
    selectionPinned.current = true;
    setFollowingLive(false);
    setSelection({ kind: "node", id });
  }

  function selectSource(node) {
    selectionPinned.current = true;
    setFollowingLive(false);
    setSelection({ kind: "source", node });
  }

  function selectActivity(item) {
    setActivityOpen(false);
    if (item.t === "brief" && brief) {
      setBriefOpen(true);
      return;
    }
    selectionPinned.current = true;
    setFollowingLive(false);
    setSelection({ kind: "activity", item });
  }

  function resumeLive() {
    selectionPinned.current = false;
    setFollowingLive(true);
    setSelection(activeNodeId ? { kind: "node", id: activeNodeId } : null);
  }

  function pauseLive() {
    if (!activeNodeId) return;
    selectionPinned.current = true;
    setFollowingLive(false);
  }

  const shownDivergence = useTween(divergence);
  const divergencePercent = Math.round(shownDivergence * 100);
  const vanillaSeries = metrics.vanilla.map((metric) => metric.value);
  const priorSeries = metrics.prior.map((metric) => metric.value);
  const hasMetrics = vanillaSeries.length + priorSeries.length > 0;
  const speedupOf = (series) => (series.length ? series[0] / series[series.length - 1] : 1);
  const vanillaSpeed = useTween(speedupOf(vanillaSeries));
  const priorSpeed = useTween(speedupOf(priorSeries));
  const allValues = [...vanillaSeries, ...priorSeries];
  const domain = allValues.length ? [Math.min(...allValues), Math.max(...allValues)] : null;

  const phase = phaseFor({
    running,
    brief,
    treeNodes,
    scoutNodes: nodes.prior,
    activeNodeId,
    error: runError,
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="wordmark" type="button" onClick={() => openPrior()} title="Open PRIOR.md">
          prior
        </button>
        <label className="objective-input">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={running}
            spellCheck={false}
            aria-label="Research objective"
          />
        </label>
        {running && (
          <span className="header-phase" aria-live="polite">
            <span className="phase-pulse" aria-hidden="true" />
            {phase}
          </span>
        )}
        <div className="header-actions">
          {connected === false && (
            <span className="connection-state" title="Reconnecting">
              <span aria-hidden="true" />
              Reconnecting
            </span>
          )}
          {TREEISH && activity.length > 0 && (
            <button className="quiet-button activity-action" type="button" onClick={() => setActivityOpen(true)}>
              Activity <span>{activity.length}</span>
            </button>
          )}
          {brief && (
            <button className="quiet-button brief-action" type="button" onClick={() => {
              setActivityOpen(false);
              setBriefOpen(true);
            }}>
              Brief
            </button>
          )}
          {(running || activity.length > 0 || !TREEISH) && (
            <button
              className={`run-button ${running ? "is-running" : ""}`}
              type="button"
              onClick={run}
            >
              {running ? "Stop" : "Explore"}
            </button>
          )}
        </div>
      </header>

      {runError && <div className="error-banner" role="alert">{runError}</div>}

      {TREEISH ? (
        <main className="tree-surface">
          <TreeCanvas
            nodes={treeNodes}
            scoutNodes={nodes.prior}
            question={question}
            running={running}
            activeNodeId={activeNodeId}
            selected={selection}
            followLive={followingLive}
            onSelectNode={selectNode}
            onSelectSource={selectSource}
            onRun={run}
            onResumeLive={resumeLive}
            onPauseLive={pauseLive}
          />
        </main>
      ) : (
        <>
          <div className="race-summary" aria-live="polite">
            {hasMetrics ? (
              <div className="race-headline" aria-label="Experiment speedups">
                <span>vanilla {fmtSpeedup(vanillaSpeed)}x</span>
                <strong>prior {fmtSpeedup(priorSpeed)}x</strong>
                <span>{divergencePercent}% divergence</span>
              </div>
            ) : (
              <span className="race-headline">{divergencePercent}% trajectory divergence</span>
            )}
          </div>
          <main className="race-workspace">
            <Column
              label="vanilla"
              items={nodes.vanilla}
              finished={done.vanilla}
              accent={false}
              series={vanillaSeries}
              domain={domain}
              onReceiptClick={openPrior}
            />
            <Column
              label="with prior"
              items={nodes.prior}
              finished={done.prior}
              accent
              series={priorSeries}
              domain={domain}
              onReceiptClick={openPrior}
            />
          </main>
        </>
      )}

      {TREEISH && activityOpen && (
        <div className="activity-layer">
          <button className="activity-scrim" type="button" onClick={() => setActivityOpen(false)} aria-label="Close activity" />
          <TrajectoryRail
            activity={activity}
            nodes={treeNodes}
            running={running}
            selected={selection}
            onClose={() => setActivityOpen(false)}
            onSelect={selectActivity}
            onSelectNode={(id) => {
              setActivityOpen(false);
              selectNode(id);
            }}
          />
        </div>
      )}

      {TREEISH && (
        <InspectorPane
          selection={selection}
          nodes={treeNodes}
          pinned={selectionPinned.current}
          onClose={() => {
            selectionPinned.current = false;
            setFollowingLive(true);
            setSelection(null);
          }}
          onResumeLive={resumeLive}
          onSelectNode={selectNode}
          onReceiptClick={openPrior}
        />
      )}

      <PriorPane
        server={SERVER}
        markdown={priorMd}
        open={paneOpen}
        setOpen={setPaneOpen}
        apiRef={priorApi}
        focusReceipt={priorReceipt}
      />

      {briefOpen && brief && (
        <BriefOverlay
          markdown={brief}
          onClose={() => setBriefOpen(false)}
          onReceiptClick={(receipt) => {
            setBriefOpen(false);
            openPrior(receipt);
          }}
        />
      )}
    </div>
  );
}
