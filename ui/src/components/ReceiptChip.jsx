import React from "react";

export function shortRef(ref) {
  if (ref.startsWith("§")) {
    const value = ref.replace(/\s*&.*$/, "");
    return value.length > 24 ? `${value.slice(0, 23)}...` : value;
  }
  if (/^https?:\/\//.test(ref)) {
    try {
      return new URL(ref).hostname.replace(/^www\./, "");
    } catch {
      return ref;
    }
  }
  return ref.length > 13 ? `${ref.slice(0, 12)}...` : ref;
}

export default function ReceiptChip({ receipt, onClick }) {
  const external = /^https?:\/\//.test(receipt.ref);
  const className = "receipt-chip";
  if (external) {
    return (
      <a className={className} href={receipt.ref} target="_blank" rel="noreferrer" title={receipt.quote || receipt.ref}>
        {shortRef(receipt.ref)}
      </a>
    );
  }
  return (
    <button className={className} type="button" onClick={() => onClick?.(receipt)} title={receipt.quote || receipt.ref}>
      {shortRef(receipt.ref)}
    </button>
  );
}
