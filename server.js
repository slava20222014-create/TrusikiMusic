// TRUSIKI MUSIC — простой Node.js сервер с общей статистикой прослушиваний.
// Запуск: npm start
// На Render задайте Start Command: npm start
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, "data", "plays.json");

const tracks = new Set(Array.from({ length: 15 }, (_, i) => i + 32));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

function readStats() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return parsed && typeof parsed.plays === "object" ? parsed : { plays: {} };
  } catch {
    return { plays: {} };
  }
}
function writeStats(stats) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const temp = DATA_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(stats, null, 2));
  fs.renameSync(temp, DATA_FILE);
}
function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(body));
}
function safeStaticPath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split("?")[0]); }
  catch { return null; }
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.resolve(ROOT, "." + (normalized.startsWith("/") ? normalized : "/" + normalized));
  return full.startsWith(ROOT + path.sep) || full === path.join(ROOT, "index.html") ? full : null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, 200, { ok: true });
  }
  if (req.method === "GET" && url.pathname === "/api/plays") {
    return send(res, 200, readStats());
  }
  const match = url.pathname.match(/^\/api\/plays\/(\d+)$/);
  if (req.method === "POST" && match) {
    const id = Number(match[1]);
    if (!tracks.has(id)) return send(res, 404, { error: "Unknown track" });
    const stats = readStats();
    stats.plays[String(id)] = Math.max(0, Number(stats.plays[String(id)]) || 0) + 1;
    try {
      writeStats(stats);
      return send(res, 200, { trackId: id, plays: stats.plays[String(id)] });
    } catch (error) {
      console.error("Cannot persist play count:", error);
      return send(res, 500, { error: "Could not save statistics" });
    }
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, { error: "Method not allowed" });
  }
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = safeStaticPath(requested);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  res.writeHead(200, {
    "Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff"
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`TRUSIKI MUSIC server listening on ${PORT}`);
  console.log(`Statistics file: ${DATA_FILE}`);
});
