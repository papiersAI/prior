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
    const domain = node.url ? domainOf(node.url) : null;
    body = (
      <span className="text-[12.5px] text-white/60">
        {node.text}
        {domain && (
          <span className="ml-2 font-mono text-[10.5px] text-white/30">{domain}</span>
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

export default function Column({ label, items, finished, accent, onReceiptClick }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  return (
    <section className="flex flex-col min-h-0 min-w-0">
      <div className="h-10 shrink-0 flex items-center gap-2.5 px-5">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/40 border border-white/10 rounded-full px-2.5 py-[3px]">
          {label}
        </span>
        {finished && <span className="text-[10px] text-white/25 font-mono">done</span>}
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
