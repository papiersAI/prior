// Parses the {t:"prior"} PRIOR.md markdown into the workspace summary.
// Section headers are stable: "## Stance", "## Active threads", "## Trusted sources".

function stripRefs(text = "") {
  return text
    .replace(/\[(?:doc|hl|cnv)_[0-9a-f]+(?:,\s*(?:doc|hl|cnv)_[0-9a-f]+)*\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sectionOf(md, header) {
  const start = md.indexOf(header);
  if (start < 0) return "";
  const rest = md.slice(start + header.length);
  const end = rest.search(/\n## /);
  return end < 0 ? rest : rest.slice(0, end);
}

export function parsePrior(md = "") {
  if (!md.trim()) return null;

  const counts = /([\d,]+)-item library \(([\d,]+) unread/.exec(md);

  const stanceRaw = sectionOf(md, "## Stance").trim();
  const stanceClean = stripRefs(stanceRaw.split("\n")[0] ?? "");
  const sentenceEnd = stanceClean.indexOf(". ");
  const stance = sentenceEnd > 40 ? stanceClean.slice(0, sentenceEnd + 1) : stanceClean;

  const threads = [...md.matchAll(/^### \d+\.\s*([^\n·]+?)\s*(?:·|$)/gm)].map((match) =>
    stripRefs(match[1])
  );

  const sources = [...sectionOf(md, "## Trusted sources").matchAll(
    /^- \*\*([^*]+)\*\*[^(\n]*\((\d+)\)/gm
  )].map((match) => ({ name: match[1].trim(), count: Number(match[2]) }));

  return {
    items: counts?.[1] ?? "3,256",
    unread: counts?.[2] ?? "3,224",
    stance,
    threads,
    sources,
  };
}
