import React, { useMemo, useRef } from "react";
import { renderBriefMarkdown } from "./safeMarkdown.js";
import useModalFocus from "./useModalFocus.js";

export default function BriefOverlay({ markdown, onClose, onReceiptClick }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  useModalFocus({ open: true, containerRef: dialogRef, initialRef: closeRef, onClose });

  // The title is the objective alone.
  const html = useMemo(() => {
    try {
      return renderBriefMarkdown(markdown.replace(/^#\s*Exploration Brief\s*[—–-]\s*/i, "# "));
    } catch {
      return "";
    }
  }, [markdown]);

  function handleArticleClick(event) {
    const receipt = event.target.closest("[data-receipt]")?.dataset.receipt;
    if (!receipt) return;
    event.preventDefault();
    onReceiptClick?.({ ref: receipt, quote: "" });
  }

  return (
    <div ref={dialogRef} className="brief-reader" role="dialog" aria-modal="true" aria-label="Idea brief" tabIndex={-1}>
      <header className="brief-header">
        <button ref={closeRef} type="button" onClick={onClose}>Back to the tree</button>
      </header>
      <div className="brief-scroll">
        <article
          className="brief-md"
          onClick={handleArticleClick}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
