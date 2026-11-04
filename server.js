import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const API_URL = process.env.NEXA_API_URL || "http://api.nexadev.my.id/ai/gpt4";
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "chats.json");
const MAX_HISTORY = Math.max(6, Math.min(60, Number(process.env.MAX_HISTORY_MESSAGES || 24)));

await fs.mkdir(DATA_DIR, { recursive: true });
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
const origins = (process.env.CORS_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin || origins.length === 0 || origins.includes(origin)) return cb(null, true);
    return cb(new Error("Origin tidak diizinkan"));
  }
}));
app.use(express.json({ limit: "32kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));

let db = {};
try { db = JSON.parse(await fs.readFile(DB_FILE, "utf8")); } catch { db = {}; }
let saveQueue = Promise.resolve();
function saveDb() {
  saveQueue = saveQueue.then(async () => {
    const tmp = DB_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, DB_FILE);
  });
  return saveQueue;
}
function cleanText(value, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function sessionId(req) {
  // Client-generated random ID; never use a name/email as a session identifier.
  const raw = cleanText(req.header("x-falzz-session"), 80);
  return /^[a-zA-Z0-9_-]{12,80}$/.test(raw) ? raw : "";
}
function getChat(id) {
  if (!db[id]) db[id] = { history: [], memory: "", personality: "Ramah, jelas, teliti, dan membantu. Jawab dalam Bahasa Indonesia kecuali diminta lain.", updatedAt: Date.now() };
  return db[id];
}


app.get("/api/health", (_req, res) => res.json({ ok: true, app: "FALZZ AI", time: new Date().toISOString() }));

app.get("/api/history", (req, res) => {
  const id = sessionId(req);
  if (!id) return res.status(400).json({ error: "Session ID tidak valid." });
  const chat = getChat(id);
  res.json({ history: chat.history, memory: chat.memory, personality: chat.personality });
});
function extractAnswer(payload) {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";

  for (const key of [
    "result",
    "answer",
    "response",
    "message",
    "text",
    "output"
  ]) {
    if (typeof payload[key] === "string" && payload[key].trim()) {
      return payload[key];
    }
  }

  if (payload.data) return extractAnswer(payload.data);

  return JSON.stringify(payload);
}
app.delete("/api/history", async (req, res) => {
  const id = sessionId(req);
  if (!id) return res.status(400).json({ error: "Session ID tidak valid." });
  db[id] = { history: [], memory: "", personality: getChat(id).personality, updatedAt: Date.now() };
  await saveDb();
  res.json({ ok: true });
});

app.put("/api/settings", async (req, res) => {
  const id = sessionId(req);
  if (!id) return res.status(400).json({ error: "Session ID tidak valid." });
  const chat = getChat(id);
  if (typeof req.body.personality === "string") chat.personality = cleanText(req.body.personality, 1200) || chat.personality;
  if (typeof req.body.memory === "string") chat.memory = cleanText(req.body.memory, 2000);
  chat.updatedAt = Date.now();
  await saveDb();
  res.json({ ok: true, personality: chat.personality, memory: chat.memory });
});

app.post("/api/chat", async (req, res) => {
  const id = sessionId(req);
  if (!id) return res.status(400).json({ error: "Session ID tidak valid. Muat ulang aplikasi." });
  const message = cleanText(req.body.message, 5000);
  if (!message) return res.status(400).json({ error: "Pesan masih kosong." });
  const mode = ["normal", "coding"].includes(req.body.mode) ? req.body.mode : "normal";
  const chat = getChat(id);
  const system = [
    "Kamu adalah FALZZ AI, asisten AI yang aman, jujur, ramah, dan teliti.",
    "Jawab dengan bahasa yang digunakan pengguna. Jangan mengaku memiliki kemampuan yang tidak tersedia.",
    "Jika tidak tahu, katakan tidak tahu. Untuk informasi terkini, gunakan fitur pencarian bila hasil pencarian tersedia.",
    `Kepribadian pengguna: ${chat.personality}`,
    chat.memory ? `Memori yang diberikan pengguna: ${chat.memory}` : "",
    mode === "coding" ? "Mode coding aktif. Berikan kode yang dapat dijalankan, jelaskan file dan langkah uji. Jangan mengarang hasil pengujian." : ""
  ].filter(Boolean).join("\n\n");

  // Context is sent as one prompt because this endpoint documents a simple ?text= interface,
  // not a verified OpenAI-style messages endpoint.
  const recent = chat.history.slice(-MAX_HISTORY);
  const context = recent.map(m => `${m.role === "user" ? "Pengguna" : "FALZZ AI"}: ${m.content}`).join("\n\n");
  const prompt = `${system}\n\nRiwayat percakapan:\n${context}\n\nPengguna: ${message}\n\nFALZZ AI:`;
  const url = new URL(API_URL);
  url.searchParams.set("q", prompt);

  try {
    const response = await fetch(url, { method: "GET", headers: { "Accept": "application/json, text/plain" }, signal: AbortSignal.timeout(45_000) });
    const raw = await response.text();
    if (!response.ok) {
      return res.status(502).json({ error: `Layanan AI mengembalikan HTTP ${response.status}.`, detail: raw.slice(0, 500) });
    }
    let payload;
    try { payload = JSON.parse(raw); } catch { payload = raw; }
    const answer = 
(payload);
    if (!answer || answer === "null") return res.status(502).json({ error: "Respons AI kosong atau formatnya belum dikenali.", raw: raw.slice(0, 500) });
    chat.history.push({ role: "user", content: message, at: Date.now() });
    chat.history.push({ role: "assistant", content: answer, at: Date.now() });
    chat.history = chat.history.slice(-MAX_HISTORY);
    chat.updatedAt = Date.now();
    await saveDb();
    res.json({ answer, history: chat.history });
  } catch (err) {
    const timeout = err.name === "TimeoutError" || err.name === "AbortError";
    res.status(502).json({ error: timeout ? "Permintaan ke AI timeout. Coba lagi." : "Tidak dapat menghubungi API Nexadev.", detail: err.message });
  }
});

// Lightweight web search via DuckDuckGo Instant Answer API.
// This is supplemental search, not a full indexed search engine.
app.get("/api/search", async (req, res) => {
  const q = cleanText(req.query.q, 240);
  if (!q) return res.status(400).json({ error: "Masukkan kata kunci pencarian." });
  try {
    const u = new URL("https://api.duckduckgo.com/");
    u.searchParams.set("q", q);
    u.searchParams.set("format", "json");
    u.searchParams.set("no_html", "1");
    u.searchParams.set("skip_disambig", "1");
    const r = await fetch(u, { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`Search HTTP ${r.status}`);
    const data = await r.json();
    const results = [];
    if (data.AbstractText) results.push({ title: data.Heading || q, snippet: data.AbstractText, url: data.AbstractURL || "" });
    for (const topic of (data.RelatedTopics || [])) {
      if (topic.Text && topic.FirstURL) results.push({ title: topic.Text.split(" - ")[0].slice(0, 120), snippet: topic.Text, url: topic.FirstURL });
      if (topic.Topics) for (const sub of topic.Topics) {
        if (sub.Text && sub.FirstURL) results.push({ title: sub.Text.split(" - ")[0].slice(0, 120), snippet: sub.Text, url: sub.FirstURL });
      }
    }
    res.json({ query: q, results: results.slice(0, 8), note: "Hasil berasal dari DuckDuckGo Instant Answer; tidak semua kueri memiliki hasil." });
  } catch (err) {
    res.status(502).json({ error: "Pencarian sementara tidak tersedia.", detail: err.message });
  }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, HOST, () => console.log(`FALZZ AI berjalan di http://${HOST}:${PORT}`));
