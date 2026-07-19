import React from "react";

// The journey spine: the whole process as narrowing geometry with live counts.
// Segments arrive from {t:"funnel"} stages when the engine emits them, plus
// client-side counts from the tree stream. Pending phases render quietly.

function Wedge() {
  return (
    <svg className="spine-wedge" width="40" height="30" viewBox="0 0 40 30" aria-hidden="true">
      <path d="M2 4 C 16 4, 27 10, 38 13" fill="none" stroke="#D8D4CC" strokeWidth="1" />
      <path d="M2 26 C 16 26, 27 20, 38 17" fill="none" stroke="#D8D4CC" strokeWidth="1" />
    </svg>
  );
}

export default function Spine({ segments }) {
  return (
    <div className="journey-spine" aria-label="Exploration progress">
      {segments.map((segment, index) => (
        <React.Fragment key={segment.label}>
          {index > 0 && <Wedge />}
          <div
            className={`spine-segment ${segment.active ? "is-active" : ""} ${segment.pending ? "is-pending" : ""}`}
          >
            <strong>{segment.value}</strong>
            <span>{segment.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
