import { Marked } from "marked";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpUrl(value = "") {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

const safeRenderer = {
  html() {
    return "";
  },
  link(token) {
    const label = this.parser.parseInline(token.tokens);
    const href = safeHttpUrl(token.href);
    if (!href) return label;
    const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
    return `<a target="_blank" rel="noreferrer" href="${escapeHtml(href)}"${title}>${label}</a>`;
  },
  image(token) {
    const href = safeHttpUrl(token.href);
    const label = escapeHtml(token.text || "Image");
    if (!href) return label;
    return `<a target="_blank" rel="noreferrer" href="${escapeHtml(href)}">${label}</a>`;
  },
};

const markdown = new Marked({ async: false, renderer: safeRenderer });
const briefMarkdown = new Marked({
  async: false,
  renderer: safeRenderer,
  extensions: [
    {
      name: "receiptUrl",
      level: "inline",
      start(source) {
        const index = source.indexOf("[http");
        return index < 0 ? undefined : index;
      },
      tokenizer(source) {
        const match = /^\[(https?:\/\/[^\]\s]+)\]/.exec(source);
        if (!match) return undefined;
        return { type: "receiptUrl", raw: match[0], href: match[1] };
      },
      renderer(token) {
        const href = safeHttpUrl(token.href);
        if (!href) return escapeHtml(token.raw);
        return `<a target="_blank" rel="noreferrer" href="${escapeHtml(href)}">${escapeHtml(domainOf(href))}</a>`;
      },
    },
    {
      name: "libraryReceipt",
      level: "inline",
      start(source) {
        const match = /\[?(?:doc|hl|cnv)_[0-9a-f]{8,}/.exec(source);
        return match?.index;
      },
      tokenizer(source) {
        const match = /^\[?((?:doc|hl|cnv)_[0-9a-f]{8,})\]?/.exec(source);
        if (!match) return undefined;
        return { type: "libraryReceipt", raw: match[0], receipt: match[1] };
      },
      renderer(token) {
        const receipt = escapeHtml(token.receipt);
        return `<button type="button" class="brief-chip" data-receipt="${receipt}">${receipt.slice(0, 12)}...</button>`;
      },
    },
  ],
});

// PRIOR.md human projection: the FILE keeps inline [doc_/hl_/cnv_] ids (the
// agent contract); the RENDERING turns them into numbered superscript marks
// and folds the CLI-facing header blockquote behind a quiet disclosure.
const priorRefState = { map: new Map(), order: [], firstQuoteDone: false };

const priorMarkdown = new Marked({
  async: false,
  renderer: {
    ...safeRenderer,
    blockquote(token) {
      if (!priorRefState.firstQuoteDone) {
        priorRefState.firstQuoteDone = true;
        const text = (token.text ?? "").replace(/\s+/g, " ").trim();
        const cut = text.search(/\.(?=\s|$)/);
        if (cut > 0) {
          const first = text.slice(0, cut + 1);
          const rest = text.slice(cut + 1).replace(/`/g, "").trim();
          return (
            `<p class="prior-subtitle">${escapeHtml(first)}</p>` +
            (rest
              ? `<details class="machine-contract"><summary>machine contract</summary><p>${escapeHtml(rest)}</p></details>`
              : "")
          );
        }
      }
      return `<blockquote>${this.parser.parse(token.tokens)}</blockquote>`;
    },
  },
  extensions: [
    {
      name: "priorReceipt",
      level: "inline",
      start(source) {
        const match = /\[(?:doc|hl|cnv)_[0-9a-f]{8,}/.exec(source);
        return match?.index;
      },
      tokenizer(source) {
        const match = /^\[((?:doc|hl|cnv)_[0-9a-f]{8,}(?:\s*,\s*(?:doc|hl|cnv)_[0-9a-f]{8,})*)\]/.exec(
          source
        );
        if (!match) return undefined;
        return { type: "priorReceipt", raw: match[0], ids: match[1].split(/\s*,\s*/) };
      },
      renderer(token) {
        return token.ids
          .map((id) => {
            if (!priorRefState.map.has(id)) {
              priorRefState.map.set(id, priorRefState.map.size + 1);
              priorRefState.order.push(id);
            }
            const number = priorRefState.map.get(id);
            const safe = escapeHtml(id);
            return `<sup class="prior-ref" data-ref="${safe}" title="${safe}">${number}</sup>`;
          })
          .join("");
      },
    },
  ],
});

function render(parser, value) {
  try {
    return parser.parse(value || "");
  } catch {
    return "";
  }
}

export function renderMarkdown(value) {
  return render(markdown, value);
}

export function renderPriorMarkdown(value) {
  priorRefState.map = new Map();
  priorRefState.order = [];
  priorRefState.firstQuoteDone = false;
  const html = render(priorMarkdown, value);
  return { html, refs: [...priorRefState.order] };
}

export function renderBriefMarkdown(value) {
  return render(briefMarkdown, value);
}
