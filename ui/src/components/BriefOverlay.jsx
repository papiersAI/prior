import React, { useMemo, useRef } from "react";
import { renderBriefMarkdown } from "./safeMarkdown.js";
import useModalFocus from "./useModalFocus.js";

export default function BriefOverlay({ markdown, onClose, onReceiptClick }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  useModalFocus({ open: true, containerRef: dialogRef, initialRef: closeRef, onClose });

  const html = useMemo(() => {
    try {
      return renderBriefMarkdown(markdown);
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
    <div ref={dialogRef} className="brief-reader" role="dialog" aria-modal="true" aria-labelledby="brief-title" tabIndex={-1}>
      <header className="brief-header">
        <div>
          <span>Exploration artifact</span>
          <strong id="brief-title">Idea brief</strong>
        </div>
        <button ref={closeRef} type="button" onClick={onClose}>Back to idea map</button>
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
