import React, { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";

export default function PriorPane({ server, markdown, open, setOpen, apiRef }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const viewRef = useRef(null);
  const taRef = useRef(null);
  const pendingCaret = useRef(null);

  const html = useMemo(() => {
    try {
      return marked.parse(markdown || "", { async: false });
    } catch {
      return "";
    }
  }, [markdown]);

  /* receipt click → scroll to + flash the matching line */
  useEffect(() => {
    apiRef.current = {
      jumpTo(receipt) {
        const container = viewRef.current;
        if (!container) return;
        const candidates = [];
        if (receipt.quote) candidates.push(receipt.quote.replace(/^-\s*/, "").slice(0, 60));
        if (receipt.ref?.startsWith("§")) candidates.push(receipt.ref.replace(/^§\s*/, ""));
        else if (receipt.ref) candidates.push(receipt.ref);
        const els = container.querySelectorAll("h1,h2,h3,h4,p,li,blockquote");
        let target = null;
        outer: for (const c of candidates) {
          for (const el of els) {
            if (el.textContent.includes(c)) {
              target = el;
              break outer;
            }
          }
        }
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.remove("flash-line");
        void target.offsetWidth; // restart the animation
        target.classList.add("flash-line");
        setTimeout(() => target.classList.remove("flash-line"), 1700);
      },
    };
  }, [apiRef]);

  /* caret placement after "+ aversion" */
  useEffect(() => {
    if (pendingCaret.current == null) return;
    const ta = taRef.current;
    if (!ta) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    ta.focus();
    ta.setSelectionRange(caret, caret);
    const line = draft.slice(0, caret).split("\n").length;
    ta.scrollTop = Math.max(0, line * 16.5 - ta.clientHeight / 2);
  }, [draft, editing]);

  async function save() {
    await fetch(`${server}/api/prior`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: draft }),
    }).catch(() => {});
    setEditing(false); // server rebroadcasts {t:"prior"} → view updates
  }

  function toggleEdit() {
    if (editing) {
      setEditing(false);
    } else {
      setDraft(markdown);
      setEditing(true);
    }
  }

  /* demo beat: one click → "- Aversion: " inserted, cursor ready */
  function addAversion() {
    const base = editing ? draft : markdown;
    const insert = "- Aversion: ";
    const marker = "## Aversions & negative space";
    const idx = base.indexOf(marker);
    let next, caret;
    if (idx >= 0) {
      const lineEnd = base.indexOf("\n", idx);
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

  if (!open) {
    return (
      <aside className="w-9 shrink-0 border-l border-white/10 flex flex-col items-center pt-4">
        <button
          onClick={() => setOpen(true)}
          className="text-white/35 hover:text-white/70 transition-colors font-mono text-[10px] tracking-[0.2em]"
          style={{ writingMode: "vertical-rl" }}
          title="open PRIOR.md"
        >
          ◂ PRIOR.md
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[400px] shrink-0 border-l border-white/10 flex flex-col min-h-0">
      <div className="h-10 shrink-0 flex items-center gap-2 px-4">
        <span className="font-mono text-[11px] text-white/50 mr-auto">PRIOR.md</span>
        <button
          onClick={addAversion}
          className="text-[11px] text-white/60 hover:text-white/90 border border-white/15
                     hover:bg-white/5 rounded-sm px-2 py-[3px] transition-colors"
        >
          + aversion
        </button>
        <button
          onClick={toggleEdit}
          className="text-[11px] text-white/60 hover:text-white/90 border border-white/15
                     hover:bg-white/5 rounded-sm px-2 py-[3px] transition-colors"
        >
          {editing ? "view" : "edit"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-white/35 hover:text-white/70 transition-colors px-1"
          title="collapse"
        >
          ▸
        </button>
      </div>

      {editing ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            spellCheck={false}
            className="flex-1 min-h-0 resize-none bg-transparent font-mono text-[11px]
                       leading-[1.5] text-white/70 px-4 py-2 outline-none"
          />
          <div className="h-8 shrink-0 flex items-center justify-between px-4 border-t border-white/10">
            <span className="font-mono text-[10px] text-white/25">⌘↵ to save — affects next step</span>
            <button
              onClick={save}
              className="text-[11px] text-white/60 hover:text-white/90 transition-colors"
            >
              save
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={viewRef}
          className="prior-md flex-1 min-h-0 overflow-y-auto px-4 pb-8"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </aside>
  );
}
