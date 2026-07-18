import React, { useEffect, useRef, useState } from "react";
import Column from "./components/Column.jsx";
import PriorPane from "./components/PriorPane.jsx";

const SERVER = "http://localhost:8787";
const FIXTURE_QUESTION =
  "What should a 2-person team build to inject human research taste into autoresearch loops?";

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
  const [divergence, setDivergence] = useState(0);
  const [status, setStatus] = useState({ run: "system", text: "idle — press run" });
  const [priorMd, setPriorMd] = useState("");
  const [done, setDone] = useState({ vanilla: false, prior: false });
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [paneOpen, setPaneOpen] = useState(true);
  const [question, setQuestion] = useState(FIXTURE_QUESTION);

  const depthRef = useRef({}); // node id → tree depth
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
        const n = ev.node;
        const depth = n.parentId ? (depthRef.current[n.parentId] ?? 0) + 1 : 0;
        depthRef.current[n.id] = depth;
        setNodes((s) => ({ ...s, [ev.run]: [...s[ev.run], { ...n, depth, step: ev.step }] }));
      } else if (ev.t === "divergence") {
        setDivergence(ev.value);
      } else if (ev.t === "status") {
        setStatus({ run: ev.run, text: ev.text });
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
    setDone({ vanilla: false, prior: false });
    setDivergence(0);
    setRunning(true);
    await fetch(`${SERVER}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }).catch(() => {
      setRunning(false);
      setStatus({ run: "system", text: "server unreachable — is `MOCK=1 node server/index.mjs` running?" });
    });
  }

  function onReceiptClick(receipt) {
    setPaneOpen(true);
    // pane may need a render to expand before we can scroll to the line
    setTimeout(() => priorApi.current?.jumpTo(receipt), 60);
  }

  const shown = useTween(divergence);
  const pct = Math.round(shown * 100);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0b] text-white select-text">
      {/* ── top bar ─────────────────────────────────────────── */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-8 px-6 h-[84px] shrink-0">
        <div className="flex items-center gap-5 min-w-0">
          <span className="text-lg font-medium tracking-[0.35em] text-white/90 shrink-0">
            prior
          </span>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            spellCheck={false}
            className="flex-1 min-w-0 max-w-xl bg-transparent font-mono text-xs text-white/60
                       placeholder-white/25 border-b border-white/10 focus:border-white/25
                       outline-none py-1.5 transition-colors"
            placeholder="research question…"
          />
          <button
            onClick={run}
            className="shrink-0 px-4 py-1.5 text-sm text-white/70 border border-white/15
                       rounded-sm hover:bg-white/5 hover:text-white/90 transition-colors"
          >
            {running ? "stop" : "run"}
          </button>
        </div>

        {/* divergence meter — must read from the back of a room */}
        <div className="flex flex-col items-center gap-1.5">
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

        <div className="flex justify-end">
          {!connected && (
            <span className="font-mono text-[10px] text-white/25">reconnecting…</span>
          )}
        </div>
      </header>

      {/* ── main split ──────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 border-t border-white/10">
        <main className="flex-1 min-w-0 grid grid-cols-2 divide-x divide-white/10">
          <Column
            label="vanilla"
            items={nodes.vanilla}
            finished={done.vanilla}
            accent={false}
            onReceiptClick={onReceiptClick}
          />
          <Column
            label="with prior"
            items={nodes.prior}
            finished={done.prior}
            accent
            onReceiptClick={onReceiptClick}
          />
        </main>
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
        {status.run !== "system" && <span className="text-white/20">[{status.run}]</span>}
        <span className="truncate">{status.text}</span>
      </footer>
    </div>
  );
}
