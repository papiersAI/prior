import React from "react";
import { domainOf, isExternalSource } from "./sourceModel.js";

function cleanSourceText(text = "") {
  let cleaned = text
    .replace(/^\s*[^\w@]+\s*/u, "")
    .replace(/^unread save:\s*/i, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.{2,}\s*$/, "")
    .trim();
  // Upstream truncation can cut mid-word; end on a word boundary instead.
  if (cleaned.length > 40 && !/[.!?…)"']$/.test(cleaned)) {
    cleaned = cleaned.replace(/\s+\S{1,12}$/, "") + "…";
  }
  return cleaned;
}

function parseSavedPost(text = "") {
  const cleaned = cleanSourceText(text);
  const match = /^@([\w]+):\s*/u.exec(cleaned);
  if (!match) return { author: null, body: cleaned };
  return {
    author: match[1],
    body: cleaned.slice(match[0].length).trim(),
  };
}

// One card grammar: author line (sans, quiet) + one-line serif title.
// No raw identifiers anywhere on the card.
function CardContent({ source }) {
  if (isExternalSource(source.ref)) {
    return (
      <>
        <span className="source-author">{domainOf(source.ref)}</span>
        <span className="source-title">{cleanSourceText(source.text) || domainOf(source.ref)}</span>
      </>
    );
  }

  const post = parseSavedPost(source.text);
  return (
    <>
      <span className="source-author">{post.author ?? "From your library"}</span>
      <span className="source-title">{post.body || cleanSourceText(source.text) || "Saved item"}</span>
    </>
  );
}

export default function SourceCard({ source, compact = false, selected = false, onOpen }) {
  const className = `source-card ${compact ? "is-compact" : ""} ${selected ? "is-selected" : ""}`;
  const content = <CardContent source={source} />;

  if (isExternalSource(source.ref)) {
    return (
      <a className={className} href={source.ref} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return (
    <button
      className={className}
      type="button"
      onClick={() => onOpen?.({ ref: source.ref, quote: source.annotation ?? source.text ?? "" })}
    >
      {content}
    </button>
  );
}
