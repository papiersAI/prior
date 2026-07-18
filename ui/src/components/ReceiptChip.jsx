import React from "react";

export function shortRef(ref) {
  if (ref.startsWith("§")) {
    const s = ref.replace(/\s*&.*$/, "");
    return s.length > 24 ? s.slice(0, 23) + "…" : s;
  }
  if (/^https?:\/\//.test(ref)) {
    try {
      return new URL(ref).hostname.replace(/^www\./, "");
    } catch {
      /* fall through */
    }
  }
  return ref.length > 10 ? ref.slice(0, 9) + "…" : ref;
}

export default function ReceiptChip({ receipt, onClick }) {
  const isUrl = /^https?:\/\//.test(receipt.ref);
  const label = shortRef(receipt.ref);
  const chipCls = `font-mono text-[10px] leading-none px-1.5 py-[3px] rounded-sm
                   border border-accent/25 text-accent/80 hover:bg-accent/10
                   hover:border-accent/40 transition-colors cursor-pointer`;
  return (
    <span className="relative group inline-block align-middle">
      {isUrl ? (
        <a href={receipt.ref} target="_blank" rel="noreferrer" className={chipCls}>
          {label}
        </a>
      ) : (
        <button onClick={() => onClick?.(receipt)} className={chipCls}>
          {label}
        </button>
      )}
      {/* tooltip: the quote behind the receipt */}
      {receipt.quote && (
        <span
          className="pointer-events-none absolute left-0 bottom-full mb-1.5 z-50 hidden
                     group-hover:block w-72 px-3 py-2 bg-[#141416] border border-white/10
                     rounded-sm text-[11px] leading-snug text-white/70 font-sans normal-case"
        >
          <span className="font-mono text-[9.5px] text-accent/70 block mb-1">{receipt.ref}</span>
          “{receipt.quote}”
        </span>
      )}
    </span>
  );
}
