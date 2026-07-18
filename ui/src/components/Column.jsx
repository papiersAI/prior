import React, { useEffect, useRef } from "react";

function shortRef(ref) {
  if (ref.startsWith("§")) {
    const s = ref.replace(/\s*&.*$/, "");
    return s.length > 24 ? s.slice(0, 23) + "…" : s;
  }
  return ref.length > 10 ? ref.slice(0, 9) + "…" : ref;
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const fmtMs = (v) => (v >= 100 ? `${Math.round(v)}ms` : `${v.toFixed(1)}ms`);

/* best_ms over iters — log scale, shared domain across lanes, no axes */
function Sparkline({ series, domain, accent }) {
  if (!series || series.length < 2 || !domain) return null;
  const W = 120;
  const H = 24;
  const P = 2.5;
  const ly = (v) => Math.log(Math.max(v, 1e-9));
  const lo = ly(domain[0]);
  const hi = ly(domain[1]);
  const span = hi - lo || 1;
  const pts = series.map((v, i) => [
    P + (i / (series.length - 1)) * (W - 2 * P),
    P + ((hi - ly(v)) / span) * (H - 2 * P),
  ]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ex, ey] = pts[pts.length - 1];
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={accent ? "text-accent" : "text-white/45"}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={ex} cy={ey} r="2" fill="currentColor" />
    </svg>
  );
}

function ReceiptChip({ receipt, onClick }) {
  return (
    <span className="relative group inline-block align-middle">
      <button
        onClick={() => onClick(receipt)}
        className="font-mono text-[10px] leading-none px-1.5 py-[3px] rounded-sm
                   border border-accent/25 text-accent/80 hover:bg-accent/10
                   hover:border-accent/40 transition-colors cursor-pointer"
      >
        {shortRef(receipt.ref)}
      </button>
      {/* tooltip: the quote behind the receipt */}
      <span
        className="pointer-events-none absolute left-0 bottom-full mb-1.5 z-50 hidden
                   group-hover:block w-72 px-3 py-2 bg-[#141416] border border-white/10
                   rounded-sm text-[11px] leading-snug text-white/70 font-sans normal-case"
      >
        <span className="font-mono text-[9.5px] text-accent/70 block mb-1">{receipt.ref}</span>
        “{receipt.quote}”
      </span>
    </span>
  );
}

function Node({ node, accent, onReceiptClick }) {
  const steered = accent && node.receipts?.length > 0;
  let body;
  if (node.kind === "query") {
    body = (
      <span className="font-mono text-[12.5px] text-white/75">
        <span className="text-white/30 mr-1.5">⌕</span>
        {node.text}
      </span>
    );
  } else if (node.kind === "result") {
    // library ids (doc_/hl_/cnv_) are not http urls — render as non-link chips
    const idUrl = node.url && /^(doc|hl|cnv)_/.test(node.url) ? node.url : null;
    const domain = !idUrl && node.url ? domainOf(node.url) : null;
    const reverted = /revert/i.test(node.text);
    body = (
      <span
        className={
          reverted
            ? "text-[12.5px] text-white/30 line-through decoration-white/25"
            : "text-[12.5px] text-white/60"
        }
      >
        {node.text}
        {domain && (
          <a
            href={node.url}
            target="_blank"
            rel="noreferrer"
            className="ml-2 font-mono text-[10.5px] text-white/30 hover:text-white/60 hover:underline transition-colors"
          >
            {domain}
          </a>
        )}
        {idUrl && (
          <button
            onClick={() => onReceiptClick({ ref: idUrl, quote: "" })}
            className="ml-2 align-middle font-mono text-[10px] leading-none px-1.5 py-[3px]
                       rounded-sm border border-white/15 text-white/45 hover:bg-white/5
                       hover:text-white/70 transition-colors cursor-pointer"
          >
            {shortRef(idUrl)}
          </button>
        )}
      </span>
    );
  } else if (node.kind === "direction") {
    body = <span className="text-[13px] font-medium text-white/90">{node.text}</span>;
  } else {
    body = <span className="text-[12.5px] italic text-white/45">{node.text}</span>;
  }

  return (
    <div className="node-in py-[3px]" style={{ paddingLeft: node.depth * 18 }}>
      <div className={steered ? "border-l-2 border-accent/40 pl-2.5" : ""}>
        {body}
        {node.receipts?.map((r, i) => (
          <span key={i} className="ml-2">
            <ReceiptChip receipt={r} onClick={onReceiptClick} />
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Column({
  label,
  items,
  finished,
  accent,
  series,
  domain,
  onReceiptClick,
}) {
  const bodyRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  const best = series?.length ? series[series.length - 1] : null;

  return (
    <section className="flex flex-col min-h-0 min-w-0">
      <div className="h-10 shrink-0 flex items-center gap-2.5 px-5">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/40 border border-white/10 rounded-full px-2.5 py-[3px]">
          {label}
        </span>
        {finished && <span className="text-[10px] text-white/25 font-mono">done</span>}
        {series?.length >= 2 && (
          <span className="ml-auto flex items-center gap-2">
            <span className="font-mono tabular-nums text-[10px] text-white/35">
              {fmtMs(best)}
            </span>
            <Sparkline series={series} domain={domain} accent={accent} />
          </span>
        )}
      </div>
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        {items.length === 0 && (
          <div className="pt-10 text-[12px] text-white/20 italic">waiting for run…</div>
        )}
        {items.map((n) => (
          <Node key={n.id} node={n} accent={accent} onReceiptClick={onReceiptClick} />
        ))}
      </div>
    </section>
  );
}
