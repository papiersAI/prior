import React, { useEffect, useMemo } from "react";
import { marked } from "marked";

/* library ids → mono chips; external links open in a new tab */
function decorate(html) {
  return html
    .replace(
      /\[?\b((?:doc|hl|cnv)_[0-9a-f]{8,})\b\]?/g,
      (_, id) => `<span class="brief-chip">${id.slice(0, 12)}…</span>`
    )
    .replace(/<a href="http/g, `<a target="_blank" rel="noreferrer" href="http`);
}

export default function BriefOverlay({ markdown, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const html = useMemo(() => {
    try {
      return decorate(marked.parse(markdown || "", { async: false }));
    } catch {
      return "";
    }
  }, [markdown]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0a0b]/[0.98]">
      <button
        onClick={onClose}
        className="fixed top-5 right-6 z-50 px-2 py-1 text-xl leading-none text-white/40
                   hover:text-white/80 transition-colors cursor-pointer"
        title="close (esc)"
      >
        ×
      </button>
      <article
        className="brief-md mx-auto max-w-[68ch] px-6 py-16"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
