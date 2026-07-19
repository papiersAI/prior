import React from "react";
import SourceCard from "./SourceCard.jsx";

function PriorSummary({ prior, onOpenPrior }) {
  if (!prior) return null;
  return (
    <section className="prior-panel" aria-label="Your research prior">
      <header className="prior-panel-heading">
        <span>Your research prior</span>
        <button type="button" onClick={() => onOpenPrior?.()}>Open PRIOR.md</button>
      </header>
      <p className="prior-stance">
        Inspect or edit the sources, preferences, and aversions shaping the agent’s decisions.
      </p>
      <p className="prior-how">
        PRIOR.md is compiled from your Papiers library. During exploration, the agent rereads it to select starting points, score ideas, and prune weak branches.
      </p>
      {prior.threads.length > 0 && (
        <div className="prior-threads">
          {prior.threads.map((thread) => (
            <span key={thread}>{thread}</span>
          ))}
        </div>
      )}
      {prior.sources.length > 0 && (
        <p className="prior-sources">
          {prior.sources.slice(0, 6).map((source, index) => (
            <React.Fragment key={source.name}>
              {index > 0 && <i aria-hidden="true"> · </i>}
              <span>
                {source.name} <b>×{source.count}</b>
              </span>
            </React.Fragment>
          ))}
        </p>
      )}
      <p className="prior-dataline">{prior.items} items · {prior.unread} unread</p>
    </section>
  );
}

// First frame: the run's inputs as real content. Objective + prior, one CTA (Run in the header).
export function ReadyWorkspace({ question, prior, onOpenPrior }) {
  return (
    <div className="workspace" role="region" aria-label="Ready workspace">
      <div className="workspace-inner">
        <section className="objective-block">
          <span className="block-label">Objective</span>
          <p className="objective-text">{question}</p>
        </section>
        <PriorSummary prior={prior} onOpenPrior={onOpenPrior} />
      </div>
    </div>
  );
}

function scoutSave(node) {
  return node.kind === "result" && /^(doc|hl|cnv)_/.test(node.url ?? "");
}

function cleanSignal(text = "") {
  return text.replace(/^\s*[^\w@]+\s*/u, "").replace(/^signal:\s*/i, "").trim();
}

// Scout phase: the library panel IS the stage. Saves appear as they are read,
// queries run beneath. The tree takes over when the first idea arrives.
export function ScoutStage({ scoutNodes, status, prior, onSelectSource }) {
  const saves = scoutNodes.filter(scoutSave);
  const queries = scoutNodes.filter((node) => node.kind === "query");
  const signals = scoutNodes.filter((node) => node.kind === "note");
  const found = scoutNodes.filter((node) => node.kind === "result" && !scoutSave(node));

  return (
    <div className="workspace is-scouting" role="region" aria-label="Reading the library">
      <div className="workspace-inner">
        <section className="scout-block">
          <header className="prior-panel-heading">
            <span>Reading your library</span>
            <strong>
              {saves.length
                ? `${saves.length} of ${prior?.items ?? "3,256"}`
                : `${prior?.items ?? "3,256"} items`}
              {saves.length > 0 && prior?.unread && (
                <i> — from the {prior.unread} unread</i>
              )}
            </strong>
          </header>
          <div className="scout-saves">
            {saves.map((node) => (
              <SourceCard
                key={node.id}
                source={{ ref: node.url, text: node.text }}
                onOpen={() => onSelectSource?.(node)}
              />
            ))}
            {saves.length === 0 && <p className="scout-waiting">Scanning the backlog…</p>}
          </div>
        </section>

        {signals.length > 0 && (
          <section className="scout-block">
            <header className="prior-panel-heading"><span>Signals</span></header>
            <ul className="scout-signals">
              {signals.slice(-4).map((node) => (
                <li key={node.id}>{cleanSignal(node.text)}</li>
              ))}
            </ul>
          </section>
        )}

        {(queries.length > 0 || found.length > 0) && (
          <section className="scout-block">
            <header className="prior-panel-heading">
              <span>Fanning outward</span>
              {found.length > 0 && <strong>{found.length} sources found</strong>}
            </header>
            <ul className="scout-queries">
              {queries.slice(-3).map((node) => (
                <li key={node.id}>{node.text}</li>
              ))}
            </ul>
          </section>
        )}

        {status && (
          <p className="scout-status" aria-live="polite">
            <span className="phase-pulse" aria-hidden="true" />
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
