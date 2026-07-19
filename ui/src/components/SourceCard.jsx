import React from "react";
import { domainOf, isExternalSource } from "./sourceModel.js";

function cleanSourceText(text = "") {
  return text
    .replace(/^\s*[^\w@]+\s*/u, "")
    .replace(/^unread save:\s*/i, "")
    .replace(/\.{2,}\s*$/, "")
    .trim();
}

function parseSavedPost(text = "") {
  const cleaned = cleanSourceText(text);
  const match = /^@([\w]+):\s*/u.exec(cleaned);
  if (!match) return { handle: null, body: cleaned };
  return {
    handle: match[1],
    body: cleaned.slice(match[0].length).trim(),
  };
}

function externalKind(ref = "") {
  const domain = domainOf(ref);
  if (/github\.com$/i.test(domain)) return "Code";
  if (/\.pdf(?:$|\?)/i.test(ref) || /arxiv|netlib|sciencedirect|nsf\.gov/i.test(domain)) return "Paper";
  if (/nvidia\.com$/i.test(domain)) return "Docs";
  return "Web";
}

function CardContent({ source }) {
  const external = isExternalSource(source.ref);
  if (external) {
    const domain = domainOf(source.ref);
    return (
      <>
        <span className="source-card-topline">
          <span className="source-favicon" aria-hidden="true">{domain.charAt(0).toUpperCase()}</span>
          <span className="source-domain">{domain}</span>
          <span className="source-kind">{externalKind(source.ref)}</span>
        </span>
        <strong className="source-card-title">{cleanSourceText(source.text) || domain}</strong>
        {source.annotation && source.annotation !== source.text && (
          <span className="source-marginalia">{source.annotation}</span>
        )}
      </>
    );
  }

  const post = parseSavedPost(source.text);
  const identity = post.handle ? `@${post.handle}` : "Saved source";
  return (
    <>
      <span className="source-card-topline">
        <span className="source-avatar" aria-hidden="true">
          {(post.handle ?? "S").charAt(0).toUpperCase()}
        </span>
        <span className="source-author">{identity}</span>
        <span className="source-kind">Unread save</span>
      </span>
      <strong className="source-card-title">{post.body || cleanSourceText(source.text)}</strong>
      {source.annotation && source.annotation !== source.text && (
        <span className="source-marginalia">{source.annotation}</span>
      )}
      <span className="source-receipt">{source.ref}</span>
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
