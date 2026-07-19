export function isExternalSource(ref = "") {
  return /^https?:\/\//.test(ref);
}

export function domainOf(ref = "") {
  try {
    return new URL(ref).hostname.replace(/^www\./, "");
  } catch {
    return ref;
  }
}
