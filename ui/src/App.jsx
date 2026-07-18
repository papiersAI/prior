import React, { useEffect, useRef, useState } from "react";
import Column from "./components/Column.jsx";
import PriorPane from "./components/PriorPane.jsx";
import TreeCanvas from "./components/TreeCanvas.jsx";
import BriefOverlay from "./components/BriefOverlay.jsx";

const SERVER = "http://localhost:8787";
const PARAMS = new URLSearchParams(window.location.search);
// pick the mock fixture via the page URL: ?fixture=tree-synthetic | tree | kernel | default | ideate
const FIXTURE = PARAMS.get("fixture");
// live engine mode: explore (idea tree, default) | pursue (dual race) — ?mode=pursue
const MODE = PARAMS.get("mode") === "pursue" ? "pursue" : "explore";
// does this page expect the tree view? (used only for the idle state + pane default)
const TREEISH = FIXTURE ? FIXTURE === "tree" || FIXTURE === "tree-synthetic" : MODE === "explore";

const FIXTURE_QUESTION =
  "What should a 2-person team build to inject human research taste into autoresearch loops?";
const KERNEL_QUESTION = "Make naive numpy attention as fast as possible on CPU";
const TREE_QUESTION = "GPU MODE — batched dense Cholesky (leaderboard 776)";

const fmtSpeedup = (s) => (s >= 10 ? String(Math.round(s)) : s.toFixed(1));

/* tween a number toward `target` for the divergence meter */
function useTween(target, ms = 600) {
  const [v, setV] = useState(target);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = v;
    const start = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(from + (target - from) * e);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

export default function App() {
  const [nodes, setNodes] = useState({ vanilla: [], prior: [] });
  const [treeNodes, setTreeNodes] = useState([]); // run:"tree" nodes, live-updated in place
  const [brief, setBrief] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [divergence, setDivergence] = useState(0);
  const [status, setStatus] = useState({ run: "system", text: "idle — press run" });
  const [tick, setTick] = useState({ run: "system", text: "idle — press run" }); // tree-mode ticker
  const [priorMd, setPriorMd] = useState("");
  const [done, setDone] = useState({ vanilla: false, prior: false });
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [paneOpen, setPaneOpen] = useState(!TREEISH);
  const [question, setQuestion] = useState(
    FIXTURE === "kernel" ? KERNEL_QUESTION : FIXTURE === "default" ? FIXTURE_QUESTION : TREE_QUESTION
  );
  const [metrics, setMetrics] = useState({ vanilla: [], prior: [] }); // best_ms per iter

  const depthRef = useRef({}); // race node id → tree depth
  const priorApi = useRef(null); // set by PriorPane: { jumpTo(receipt) }

  useEffect(() => {
    const es = new EventSource(`${SERVER}/events`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      let ev;
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      if (ev.t === "node") {
        if (ev.run === "tree") {
          setTreeNodes((s) => [...s, { ...ev.node }]);
        } else {
          // race lanes; during a tree run these are the scout's seed-reading events →
          // they surface in the bottom ticker only (the canvas ignores them)
          const n = ev.node;
          const depth = n.parentId ? (depthRef.current[n.parentId] ?? 0) + 1 : 0;
          depthRef.current[n.id] = depth;
          setNodes((s) => ({ ...s, [ev.run]: [...s[ev.run], { ...n, depth, step: ev.step }] }));
          setTick({ run: ev.run, text: n.text });
        }
      } else if (ev.t === "update") {
        setTreeNodes((s) =>
          s.map((n) =>
            n.id === ev.nodeId
              ? { ...n, score: ev.score ?? n.score, status: ev.status ?? n.status }
              : n
          )
        );
      } else if (ev.t === "brief") {
        setBrief(ev.markdown);
        setRunning(false);
      } else if (ev.t === "divergence") {
        setDivergence(ev.value);
      } else if (ev.t === "metric") {
        setMetrics((s) => ({
          ...s,
          [ev.run]: [...(s[ev.run] ?? []), { iter: ev.iter, value: ev.value }],
        }));
      } else if (ev.t === "status") {
        setStatus({ run: ev.run, text: ev.text });
        setTick({ run: ev.run, text: ev.text });
      } else if (ev.t === "prior") {
        setPriorMd(ev.markdown);
      } else if (ev.t === "done") {
        setDone((s) => {
          const next = { ...s, [ev.run]: true };
          if (next.vanilla && next.prior) setRunning(false);
          return next;
        });
      }
    };
    return () => es.close();
  }, []);

  async function run() {
    if (running) {
      await fetch(`${SERVER}/api/stop`, { method: "POST" }).catch(() => {});
      setRunning(false);
      return;
    }
    depthRef.current = {};
    setNodes({ vanilla: [], prior: [] });
    setTreeNodes([]);
    setBrief(null);
    setBriefOpen(false);
    setDone({ vanilla: false, prior: false });
    setDivergence(0);
    setMetrics({ vanilla: [], prior: [] });
    setRunning(true);
    const runUrl = FIXTURE
      ? `${SERVER}/api/run?fixture=${encodeURIComponent(FIXTURE)}`
      : `${SERVER}/api/run`;
    const res = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, mode: MODE }),
    }).catch(() => null);
    if (!res) {
      setRunning(false);
      setStatus({ run: "system", text: "server unreachable — is `node server/index.mjs` running?" });
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setRunning(false);
      const text = err.error ?? `run failed (${res.status})`;
      setStatus({ run: "system", text });
      setTick({ run: "system", text });
    }
  }

  function onReceiptClick(receipt) {
    setPaneOpen(true);
    // pane may need a render to expand before we can scroll to the line
    setTimeout(() => priorApi.current?.jumpTo(receipt), 60);
  }

  const treeMode = treeNodes.length > 0;
  const raceActive =
    nodes.vanilla.length > 0 || (!treeMode && nodes.prior.length > 0) || divergence > 0;

  const shown = useTween(divergence);
  const pct = Math.round(shown * 100);

  // experiment mode: metric events flip the headline to per-lane speedup vs baseline
  const vSeries = metrics.vanilla.map((m) => m.value);
  const pSeries = metrics.prior.map((m) => m.value);
  const hasMetrics = vSeries.length + pSeries.length > 0;
  const speedupOf = (arr) => (arr.length ? arr[0] / arr[arr.length - 1] : 1);
  const vSpeed = useTween(speedupOf(vSeries));
  const pSpeed = useTween(speedupOf(pSeries));
  const allValues = [...vSeries, ...pSeries];
  const domain = allValues.length
    ? [Math.min(...allValues), Math.max(...allValues)]
    : null;

  const ticker = treeMode ? tick : status;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0b] text-white select-text">
      {/* ── top bar ─────────────────────────────────────────── */}
      <header className="flex items-center gap-5 px-6 h-[72px] shrink-0">
        <span className="text-lg font-medium tracking-[0.35em] text-white/90 shrink-0">
          prior
        </span>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent font-mono text-xs text-white/60
                     placeholder-white/25 border-b border-white/10 focus:border-white/25
                     outline-none py-1.5 transition-colors"
          placeholder="task file or research question…"
        />

        {/* race headline — must read from the back of a room (untouched code path) */}
        {!treeMode && hasMetrics && (
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="flex items-baseline gap-3 font-mono tabular-nums leading-none">
              <span className="text-sm text-white/40">vanilla</span>
              <span className="text-4xl font-semibold text-white/80">
                {fmtSpeedup(vSpeed)}×
              </span>
              <span className="text-2xl text-white/15 mx-1">|</span>
              <span className="text-sm text-white/40">prior</span>
              <span className="text-4xl font-semibold text-accent">
                {fmtSpeedup(pSpeed)}×
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono tabular-nums text-xs text-white/45">{pct}%</span>
              <span className="text-[9px] uppercase tracking-[0.28em] text-white/30">
                technique divergence
              </span>
            </div>
          </div>
        )}
        {!treeMode && !hasMetrics && raceActive && (
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <span className="font-mono tabular-nums text-4xl font-semibold text-accent leading-none">
              {pct}%
            </span>
            <div className="w-56 h-[3px] bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${Math.min(100, shown * 100)}%` }}
              />
            </div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">
              trajectory divergence
            </span>
          </div>
        )}

        {brief && (
          <button
            onClick={() => setBriefOpen(true)}
            className="shrink-0 px-3 py-1.5 text-[12px] text-white/60 border border-white/15
                       rounded-sm hover:bg-white/5 hover:text-white/90 transition-colors cursor-pointer"
          >
            view brief
          </button>
        )}
        <button
          onClick={run}
          className="shrink-0 px-4 py-1.5 text-sm text-white/70 border border-white/15
                     rounded-sm hover:bg-white/5 hover:text-white/90 transition-colors cursor-pointer"
        >
          {running ? "stop" : "run"}
        </button>
        {!connected && (
          <span className="shrink-0 font-mono text-[10px] text-white/25">reconnecting…</span>
        )}
      </header>

      {/* ── main split ──────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 border-t border-white/10">
        {treeMode ? (
          <main className="flex-1 min-w-0 min-h-0">
            <TreeCanvas nodes={treeNodes} onReceiptClick={onReceiptClick} />
          </main>
        ) : TREEISH ? (
          <main className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
            <span className="text-[12.5px] italic text-white/20">
              press run to grow the idea tree
            </span>
          </main>
        ) : (
          <main className="flex-1 min-w-0 grid grid-cols-2 divide-x divide-white/10">
            <Column
              label="vanilla"
              items={nodes.vanilla}
              finished={done.vanilla}
              accent={false}
              series={vSeries}
              domain={domain}
              onReceiptClick={onReceiptClick}
            />
            <Column
              label="with prior"
              items={nodes.prior}
              finished={done.prior}
              accent
              series={pSeries}
              domain={domain}
              onReceiptClick={onReceiptClick}
            />
          </main>
        )}
        <PriorPane
          server={SERVER}
          markdown={priorMd}
          open={paneOpen}
          setOpen={setPaneOpen}
          apiRef={priorApi}
        />
      </div>

      {/* ── status ticker ───────────────────────────────────── */}
      <footer className="h-8 shrink-0 border-t border-white/10 flex items-center px-5 gap-3 font-mono text-[11px] text-white/35 overflow-hidden whitespace-nowrap">
        {ticker.run !== "system" && <span className="text-white/20">[{ticker.run}]</span>}
        <span className="truncate">{ticker.text}</span>
      </footer>

      {briefOpen && brief && <BriefOverlay markdown={brief} onClose={() => setBriefOpen(false)} />}
    </div>
  );
}
