import React, { useEffect, useRef } from "react";
import ReceiptChip, { shortRef } from "./ReceiptChip.jsx";

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const fmtMs = (value) => (value >= 100 ? `${Math.round(value)} ms` : `${value.toFixed(1)} ms`);

function Sparkline({ series, domain, accent }) {
  if (!series || series.length < 2 || !domain) return null;
  const width = 120;
  const height = 24;
  const padding = 2.5;
  const logValue = (value) => Math.log(Math.max(value, 1e-9));
  const low = logValue(domain[0]);
  const high = logValue(domain[1]);
  const span = high - low || 1;
  const points = series.map((value, index) => [
    padding + (index / (series.length - 1)) * (width - 2 * padding),
    padding + ((high - logValue(value)) / span) * (height - 2 * padding),
  ]);
  const path = points
    .map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const [endX, endY] = points.at(-1);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`race-sparkline ${accent ? "is-accent" : ""}`}
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={endX} cy={endY} r="2" fill="currentColor" />
    </svg>
  );
}

function RaceNode({ node, accent, onReceiptClick }) {
  const steered = accent && node.receipts?.length > 0;
  const idUrl = node.url && /^(doc|hl|cnv)_/.test(node.url) ? node.url : null;
  const domain = !idUrl && node.url ? domainOf(node.url) : null;
  const reverted = node.kind === "result" && /revert/i.test(node.text);

  return (
    <article
      className={`race-event ${steered ? "is-steered" : ""} ${reverted ? "is-reverted" : ""}`}
      style={{ marginLeft: node.depth * 18 }}
      data-kind={node.kind}
    >
      <span className="race-event-kind">{node.kind}</span>
      <div className="race-event-copy">
        <p>{node.text}</p>
        {(domain || idUrl || node.receipts?.length > 0) && (
          <div className="race-event-sources">
            {domain && (
              <a href={node.url} target="_blank" rel="noreferrer">{domain}</a>
            )}
            {idUrl && (
              <button type="button" onClick={() => onReceiptClick({ ref: idUrl, quote: node.text })}>
                {shortRef(idUrl)}
              </button>
            )}
            {node.receipts?.map((receipt, index) => (
              <ReceiptChip key={`${receipt.ref}-${index}`} receipt={receipt} onClick={onReceiptClick} />
            ))}
          </div>
        )}
      </div>
    </article>
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
    const element = bodyRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [items.length]);

  const best = series?.length ? series.at(-1) : null;

  return (
    <section className={`race-column ${accent ? "is-prior" : ""}`}>
      <header className="race-column-header">
        <div>
          <span>{label}</span>
          {finished && <strong>Complete</strong>}
        </div>
        {series?.length >= 2 && (
          <div className="race-metric">
            <span>{fmtMs(best)}</span>
            <Sparkline series={series} domain={domain} accent={accent} />
          </div>
        )}
      </header>
      <div ref={bodyRef} className="race-column-body">
        {items.length === 0 ? (
          <p className="race-empty">Waiting for the experiment loop.</p>
        ) : (
          items.map((node) => (
            <RaceNode key={node.id} node={node} accent={accent} onReceiptClick={onReceiptClick} />
          ))
        )}
      </div>
    </section>
  );
}
