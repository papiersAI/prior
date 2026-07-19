import React, { useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "./safeMarkdown.js";
import useModalFocus from "./useModalFocus.js";

export default function PriorPane({ server, markdown, open, setOpen, apiRef, focusReceipt }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [missingReceipt, setMissingReceipt] = useState(null);
  const viewRef = useRef(null);
  const textareaRef = useRef(null);
  const drawerRef = useRef(null);
  const closeRef = useRef(null);
  const pendingCaret = useRef(null);

  const html = useMemo(() => {
    try {
      return renderMarkdown(markdown);
    } catch {
      return "";
    }
  }, [markdown]);

  useEffect(() => {
    apiRef.current = {
      jumpTo(receipt) {
        const container = viewRef.current;
        if (!container) return false;
        const candidates = [];
        if (receipt.quote) candidates.push(receipt.quote.replace(/^-\s*/, "").slice(0, 60));
        if (receipt.ref?.startsWith("§")) candidates.push(receipt.ref.replace(/^§\s*/, ""));
        else if (receipt.ref) candidates.push(receipt.ref);
        const elements = container.querySelectorAll("h1,h2,h3,h4,p,li,blockquote");
        let target = null;
        outer: for (const candidate of candidates) {
          for (const element of elements) {
            if (element.textContent.includes(candidate)) {
              target = element;
              break outer;
            }
          }
        }
        if (!target) {
          setMissingReceipt(receipt);
          return false;
        }
        setMissingReceipt(null);
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.remove("flash-line");
        void target.offsetWidth;
        target.classList.add("flash-line");
        setTimeout(() => target.classList.remove("flash-line"), 1700);
        return true;
      },
    };
  }, [apiRef]);

  useEffect(() => {
    if (!open || !focusReceipt || editing) return;
    const timer = setTimeout(() => apiRef.current?.jumpTo(focusReceipt), 60);
    return () => clearTimeout(timer);
  }, [apiRef, editing, focusReceipt, open, html]);

  useEffect(() => {
    if (!open || focusReceipt) return;
    setMissingReceipt(null);
  }, [focusReceipt, open]);

  useModalFocus({
    open,
    containerRef: drawerRef,
    initialRef: closeRef,
    onClose: () => setOpen(false),
  });

  useEffect(() => {
    if (pendingCaret.current == null) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
    const line = draft.slice(0, caret).split("\n").length;
    textarea.scrollTop = Math.max(0, line * 18 - textarea.clientHeight / 2);
  }, [draft, editing]);

  async function save() {
    setSaveState("saving");
    setSaveError("");
    const response = await fetch(`${server}/api/prior`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: draft }),
    }).catch(() => null);

    if (!response?.ok) {
      setSaveState("error");
      setSaveError(response ? `Save failed (${response.status})` : "Save failed. The server is unreachable.");
      return;
    }
    setSaveState("saved");
    setEditing(false);
    setTimeout(() => setSaveState("idle"), 1400);
  }

  function toggleEdit() {
    if (editing) {
      setEditing(false);
      setSaveError("");
    } else {
      setDraft(markdown);
      setEditing(true);
    }
  }

  function addAversion() {
    const base = editing ? draft : markdown;
    const insert = "- Aversion: ";
    const marker = "## Aversions & negative space";
    const index = base.indexOf(marker);
    let next;
    let caret;
    if (index >= 0) {
      const lineEnd = base.indexOf("\n", index);
      const at = lineEnd >= 0 ? lineEnd + 1 : base.length;
      next = base.slice(0, at) + insert + "\n" + base.slice(at);
      caret = at + insert.length;
    } else {
      next = base.replace(/\n*$/, "\n\n") + insert + "\n";
      caret = next.length - 1;
    }
    pendingCaret.current = caret;
    setDraft(next);
    setEditing(true);
  }

  if (!open) return null;

  return (
    <div className="drawer-layer" role="presentation">
      <button className="drawer-scrim" type="button" onClick={() => setOpen(false)} aria-label="Close PRIOR.md" />
      <aside ref={drawerRef} className="prior-drawer" role="dialog" aria-modal="true" aria-label="PRIOR.md taste file" tabIndex={-1}>
        <header className="drawer-header">
          <div>
            <span>Taste file</span>
            <strong>PRIOR.md</strong>
          </div>
          <div className="drawer-actions">
            <button type="button" onClick={addAversion}>Add aversion</button>
            <button type="button" onClick={toggleEdit}>{editing ? "Cancel edit" : "Edit"}</button>
            <button ref={closeRef} type="button" onClick={() => setOpen(false)}>Close</button>
          </div>
        </header>

        {missingReceipt && !editing && focusReceipt?.ref === missingReceipt.ref && (
          <div className="receipt-miss" role="status">
            <span>Direct library receipt</span>
            <strong>{missingReceipt.ref}</strong>
            {missingReceipt.quote && <p>{missingReceipt.quote}</p>}
            <small>This seed was selected from the full library and is not materialized in the current PRIOR.md index.</small>
          </div>
        )}

        {editing ? (
          <div className="prior-editor">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  save();
                }
              }}
              spellCheck={false}
              aria-label="Edit PRIOR.md"
            />
            <footer>
              <span className={saveState === "error" ? "is-error" : ""}>
                {saveError || (saveState === "saving" ? "Saving" : "Editing working prior")}
              </span>
              <button type="button" onClick={save} disabled={saveState === "saving"}>
                {saveState === "saving" ? "Saving" : "Save changes"}
              </button>
            </footer>
          </div>
        ) : (
          <div ref={viewRef} className="prior-md" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </aside>
    </div>
  );
}
