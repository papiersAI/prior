#!/usr/bin/env node
// prior demo server — zero-dependency (Node >= 22).
// Contract: shared/events.md. Mock mode: MOCK=1 node server/index.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PRIOR_PATH = path.join(ROOT, "PRIOR.md");
const WORKING_PATH = path.join(__dirname, ".prior-working.md");
const FIXTURE_PATH = path.join(__dirname, "fixtures", "demo-run.jsonl");
const PORT = 8787;
const MOCK = process.env.MOCK === "1";

// ---------------------------------------------------------------- state
let prior = "";
try {
  prior = fs.readFileSync(PRIOR_PATH, "utf8");
} catch {
  prior = "# PRIOR\n\n(no PRIOR.md found at repo root)\n";
}

const clients = new Set();

function sseWrite(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function broadcast(event) {
  for (const c of clients) sseWrite(c, event);
}

// heartbeat every 15s (SSE comment lines are ignored by EventSource)
setInterval(() => {
  for (const c of clients) c.write(": hb\n\n");
}, 15_000).unref();

// ---------------------------------------------------------------- mock playback
let playback = null; // { events, i, timer, pendingAversion }

function loadFixture() {
  const raw = fs.readFileSync(FIXTURE_PATH, "utf8");
  const events = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      events.push(JSON.parse(t));
    } catch {
      console.error("fixture: skipping malformed line:", t.slice(0, 80));
    }
  }
  return events;
}

function stopPlayback() {
  if (playback?.timer) clearTimeout(playback.timer);
  playback = null;
}

function startMockRun(question) {
  stopPlayback();
  let events;
  try {
    events = loadFixture(); // re-read each run so fixture edits need no restart
  } catch (e) {
    broadcast({ t: "status", run: "system", text: `fixture missing: ${e.message}` });
    return;
  }
  playback = { events, i: 0, timer: null, pendingAversion: null };
  broadcast({ t: "status", run: "system", text: `dual run started — "${question}"` });
  scheduleNext();
}

function scheduleNext() {
  if (!playback || playback.i >= playback.events.length) {
    playback = null;
    return;
  }
  const delay = 400 + Math.floor(Math.random() * 800); // 400–1200ms
  playback.timer = setTimeout(() => {
    if (!playback) return;
    const ev = playback.events[playback.i++];
    broadcast(ev);
    // Live-edit beat: after the next prior-run node following a posted
    // "- Aversion:" line, emit a scripted prune note citing that line.
    if (playback.pendingAversion && ev.t === "node" && ev.run === "prior") {
      const aversion = playback.pendingAversion;
      playback.pendingAversion = null;
      setTimeout(() => {
        broadcast({
          t: "status",
          run: "prior",
          text: `branch scorer: direction pruned — matches a live edit to PRIOR.md`,
        });
        broadcast({
          t: "node",
          run: "prior",
          step: ev.step,
          node: {
            id: `prune_${Date.now().toString(36)}`,
            parentId: ev.node.id,
            kind: "note",
            text: `pruned: dropping this direction — the prior was just edited ("${aversion}")`,
            receipts: [{ ref: "§ Aversions & negative space", quote: `- Aversion: ${aversion}` }],
          },
        });
      }, 500);
    }
    scheduleNext();
  }, delay);
}

// ---------------------------------------------------------------- http
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 5_000_000) req.destroy();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS for the vite dev UI (http://localhost:5173)
  const origin = req.headers.origin;
  const allowed =
    origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ? origin
      : "http://localhost:5173";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ---- SSE stream
  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": connected\n\n");
    sseWrite(res, { t: "prior", markdown: prior });
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  // ---- start dual run
  if (req.method === "POST" && url.pathname === "/api/run") {
    let question = "";
    try {
      question = JSON.parse((await readBody(req)) || "{}").question ?? "";
    } catch {
      json(res, 400, { error: "invalid JSON" });
      return;
    }
    if (MOCK) {
      startMockRun(question);
    } else {
      broadcast({
        t: "status",
        run: "system",
        text: "no live engine attached — start the server with MOCK=1 for the demo fixture",
      });
    }
    json(res, 202, { ok: true });
    return;
  }

  // ---- replace prior
  if (req.method === "POST" && url.pathname === "/api/prior") {
    let markdown;
    try {
      markdown = JSON.parse((await readBody(req)) || "{}").markdown;
    } catch {
      json(res, 400, { error: "invalid JSON" });
      return;
    }
    if (typeof markdown !== "string") {
      json(res, 400, { error: "markdown must be a string" });
      return;
    }
    prior = markdown;
    try {
      fs.writeFileSync(WORKING_PATH, markdown); // never overwrite root PRIOR.md
    } catch (e) {
      console.error("could not write working copy:", e.message);
    }
    broadcast({ t: "prior", markdown });
    if (MOCK && playback) {
      const aversions = markdown
        .split("\n")
        .filter((l) => l.trimStart().startsWith("- Aversion:"))
        .map((l) => l.trimStart().slice("- Aversion:".length).trim())
        .filter(Boolean);
      if (aversions.length) playback.pendingAversion = aversions[aversions.length - 1];
    }
    json(res, 200, { ok: true });
    return;
  }

  // ---- read prior
  if (req.method === "GET" && url.pathname === "/api/prior") {
    json(res, 200, { markdown: prior });
    return;
  }

  // ---- stop
  if (req.method === "POST" && url.pathname === "/api/stop") {
    stopPlayback();
    broadcast({ t: "status", run: "system", text: "run stopped" });
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`prior server → http://localhost:${PORT}  (mock: ${MOCK ? "on" : "off"})`);
});
