
// TRUSIKI MUSIC — Node.js сервер с общей статистикой прослушиваний.
// Запуск: npm start
// Render Start Command: npm start

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

// Начальная статистика берётся из существующего файла GitHub.
const DATA_FILE = path.join(ROOT, "data", "plays.json");

// Счётчики для всех композиций сайта.
const tracks = new Set(
  Array.from({ length: 46 }, (_, i) => i + 1)
);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// Загружаем начальную статистику из plays.json.
function readStats() {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    if (
      parsed &&
      parsed.plays &&
      typeof parsed.plays === "object" &&
      !Array.isArray(parsed.plays)
    ) {
      return parsed;
    }

    return { plays: {} };
  } catch (error) {
    console.error("Cannot read initial statistics:", error.message);
    return { plays: {} };
  }
}

// Статистика хранится в оперативной памяти.
// На бесплатном Render запись на диск не производится.
const stats = readStats();

// Отправка JSON.
function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });

  res.end(JSON.stringify(body));
}

// Защита пути к статическим файлам.
function safeStaticPath(urlPath) {
  let decoded;

  try {
    decoded = decodeURIComponent(
      urlPath.split("?")[0]
    );
  } catch {
    return null;
  }

  const normalized = path.normalize(decoded)
    .replace(/^(\.\.[/\\])+/, "");

  const full = path.resolve(
    ROOT,
    "." + (
      normalized.startsWith("/")
        ? normalized
        : "/" + normalized
    )
  );

  return (
    full.startsWith(ROOT + path.sep) ||
    full === path.join(ROOT, "index.html")
  ) ? full : null;
}

// HTTP-сервер.
const server = http.createServer((req, res) => {
  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  // Проверка состояния сервера.
  if (
    req.method === "GET" &&
    url.pathname === "/api/health"
  ) {
    return send(res, 200, {
      ok: true
    });
  }

  // Получение статистики всех треков.
  if (
    req.method === "GET" &&
    url.pathname === "/api/plays"
  ) {
    return send(res, 200, stats);
  }

  // Увеличение счётчика прослушиваний.
  const match = url.pathname.match(
    /^\/api\/plays\/(\d+)$/
  );

  if (
    req.method === "POST" &&
    match
  ) {
    const id = Number(match[1]);

    if (!tracks.has(id)) {
      return send(res, 404, {
        error: "Unknown track"
      });
    }

    const key = String(id);

    stats.plays[key] =
      Math.max(
        0,
        Number(stats.plays[key]) || 0
      ) + 1;

    return send(res, 200, {
      trackId: id,
      plays: stats.plays[key]
    });
  }

  // Разрешаем только GET и HEAD для файлов сайта.
  if (
    req.method !== "GET" &&
    req.method !== "HEAD"
  ) {
    return send(res, 405, {
      error: "Method not allowed"
    });
  }

  const requested =
    url.pathname === "/"
      ? "/index.html"
      : url.pathname;

  const file = safeStaticPath(requested);

  if (
    !file ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    return res.end("Not found");
  }

  // Отправка статического файла.
  res.writeHead(200, {
    "Content-Type":
      mime[path.extname(file).toLowerCase()] ||
      "application/octet-stream",

    "X-Content-Type-Options": "nosniff"
  });

  if (req.method === "HEAD") {
    return res.end();
  }

  fs.createReadStream(file).pipe(res);
});

// Запуск сервера.
server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `TRUSIKI MUSIC server listening on ${PORT}`
  );

  console.log(
    `Initial statistics loaded from: ${DATA_FILE}`
  );

  console.log(
    "Statistics mode: in-memory (Render Free)"
  );
});
