const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 5177);
const PUBLIC_DIR = path.join(__dirname, "public");
const HOST_PIN = process.env.HOST_PIN || "vled_admin";
const HOST_COOKIE = "ai_minor_host";

const solution = [
  [8, 1, 6],
  [3, 5, 7],
  [4, 9, 2]
];

const puzzleMask = [
  [1, 0, 1],
  [0, 1, 0],
  [1, 0, 0]
];

const MATRIX_SIZE = 3;
const MAGIC_TARGET = 15;
const MAGIC_LINE_TOTAL = 8;

const fakeRealItems = [
  { id: "real_01", src: "/assets/fake-real/real_01.jpg", answer: "real" },
  { id: "fake_01", src: "/assets/fake-real/fake_01.png", answer: "fake" },
  { id: "real_02", src: "/assets/fake-real/real_02.png", answer: "real" },
  { id: "fake_02", src: "/assets/fake-real/fake_02.png", answer: "fake" },
  { id: "real_03", src: "/assets/fake-real/real_03.jpg", answer: "real" },
  { id: "fake_03", src: "/assets/fake-real/fake_03.png", answer: "fake" },
  { id: "real_04", src: "/assets/fake-real/real_04.webp", answer: "real" }
];

const state = {
  difference: {
    startedAt: null,
    joined: new Map(),
    submissions: new Map()
  },
  matrix: {
    startedAt: null,
    joined: new Map(),
    submissions: new Map(),
    solution
  },
  fakeReal: {
    startedAt: null,
    joined: new Map(),
    submissions: new Map(),
    items: fakeRealItems
  }
};

function localAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(`http://${entry.address}:${PORT}`);
      }
    }
  }
  return addresses;
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function isHostAuthenticated(req) {
  return parseCookies(req)[HOST_COOKIE] === HOST_PIN;
}

function isHostPath(pathname) {
  return pathname === "/" || pathname === "/host" || pathname.startsWith("/host/");
}

function serveLogin(req, res) {
  const loginPath = path.join(PUBLIC_DIR, "admin-login.html");
  fs.readFile(loginPath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Host login page missing");
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(data);
  });
}

function requireHost(req, res) {
  if (isHostAuthenticated(req)) return true;
  json(res, 403, { error: "Host PIN required" });
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function cleanName(name) {
  return String(name || "Participant").trim().slice(0, 40) || "Participant";
}

function rankList(activity) {
  return [...state[activity].submissions.values()]
    .sort((a, b) => {
      if (b.completed !== a.completed) return Number(b.completed) - Number(a.completed);
      if (b.score !== a.score) return b.score - a.score;
      return a.timeMs - b.timeMs;
    })
    .slice(0, 30)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
}

function joinedList(activity) {
  return [...state[activity].joined.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((entry, index) => ({ number: index + 1, ...entry }));
}

function participantKey(body) {
  return `${cleanName(body.name).toLowerCase()}-${String(body.deviceId || "").slice(0, 80)}`;
}

function matrixPuzzle() {
  return state.matrix.solution.map((row, r) =>
    row.map((value, c) => (puzzleMask[r][c] ? value : null))
  );
}

function isValidMatrix(grid) {
  if (!Array.isArray(grid) || grid.length !== MATRIX_SIZE) return false;
  return grid.every(row => Array.isArray(row) && row.length === MATRIX_SIZE);
}

function magicLines(grid) {
  return [
    grid[0],
    grid[1],
    grid[2],
    [grid[0][0], grid[1][0], grid[2][0]],
    [grid[0][1], grid[1][1], grid[2][1]],
    [grid[0][2], grid[1][2], grid[2][2]],
    [grid[0][0], grid[1][1], grid[2][2]],
    [grid[0][2], grid[1][1], grid[2][0]]
  ];
}

function scoreMagicSquare(grid) {
  const normalized = grid.map(row => row.map(value => Number(value)));
  const filled = normalized.flat().every(value => Number.isInteger(value) && value >= 1 && value <= 9);
  const lineSums = magicLines(normalized).map(line => line.reduce((sum, value) => sum + value, 0));
  const score = filled ? lineSums.filter(sum => sum === MAGIC_TARGET).length : 0;
  return { score, completed: score === MAGIC_LINE_TOTAL, lineSums, filled };
}

function staticFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (isHostPath(pathname) && !isHostAuthenticated(req)) {
    return serveLogin(req, res);
  }
  if (pathname === "/" || pathname === "/host") pathname = "/index.html";
  if (pathname === "/host/difference") pathname = "/host-activity.html";
  if (pathname === "/host/matrix") pathname = "/host-activity.html";
  if (pathname === "/host/fake-real") pathname = "/host-activity.html";
  if (pathname === "/host/leaderboards") pathname = "/leaderboards.html";
  if (pathname === "/play/difference") pathname = "/difference.html";
  if (pathname === "/play/matrix") pathname = "/matrix.html";
  if (pathname === "/play/fake-real") pathname = "/fake-real.html";

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp"
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(data);
  });
}

async function api(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/host-login") {
    const body = await readBody(req);
    if (String(body.pin || "") !== HOST_PIN) {
      return json(res, 401, { ok: false, error: "Invalid host PIN" });
    }
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": `${HOST_COOKIE}=${encodeURIComponent(HOST_PIN)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
    });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === "POST" && url.pathname === "/api/host-logout") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": `${HOST_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    return json(res, 200, {
      difference: {
        startedAt: state.difference.startedAt,
        joined: joinedList("difference"),
        joinedCount: state.difference.joined.size,
        leaderboard: rankList("difference")
      },
      matrix: {
        startedAt: state.matrix.startedAt,
        joined: joinedList("matrix"),
        joinedCount: state.matrix.joined.size,
        leaderboard: rankList("matrix")
      },
      fakeReal: {
        startedAt: state.fakeReal.startedAt,
        joined: joinedList("fakeReal"),
        joinedCount: state.fakeReal.joined.size,
        leaderboard: rankList("fakeReal")
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    const lanUrls = localAddresses();
    const proto = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const requestBaseUrl = `${proto}://${host}`;
    const isLocalHost = String(host || "").startsWith("localhost") || String(host || "").startsWith("127.0.0.1");
    const baseUrl = isLocalHost ? (lanUrls[0] || requestBaseUrl) : requestBaseUrl;
    return json(res, 200, {
      baseUrl,
      lanUrls,
      localhost: `http://localhost:${PORT}`
    });
  }

  if (req.method === "POST" && url.pathname === "/api/start") {
    if (!requireHost(req, res)) return;
    const body = await readBody(req);
    if (!["difference", "matrix", "fakeReal", "all"].includes(body.activity)) {
      return json(res, 400, { error: "Unknown activity" });
    }
    const now = Date.now();
    if (body.activity === "all" || body.activity === "difference") {
      state.difference.startedAt = now;
      state.difference.submissions.clear();
    }
    if (body.activity === "all" || body.activity === "matrix") {
      state.matrix.startedAt = now;
      state.matrix.submissions.clear();
    }
    if (body.activity === "all" || body.activity === "fakeReal") {
      state.fakeReal.startedAt = now;
      state.fakeReal.submissions.clear();
    }
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/join") {
    const body = await readBody(req);
    if (!["difference", "matrix", "fakeReal"].includes(body.activity)) {
      return json(res, 400, { error: "Unknown activity" });
    }
    const key = participantKey(body);
    const entry = {
      name: cleanName(body.name),
      deviceId: String(body.deviceId || "").slice(0, 80),
      joinedAt: Date.now()
    };
    state[body.activity].joined.set(key, entry);
    return json(res, 200, {
      ok: true,
      joinedCount: state[body.activity].joined.size,
      joined: joinedList(body.activity)
    });
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    if (!requireHost(req, res)) return;
    const body = await readBody(req);
    if (!["difference", "matrix", "fakeReal", "all"].includes(body.activity)) {
      return json(res, 400, { error: "Unknown activity" });
    }
    if (body.activity === "all" || body.activity === "difference") {
      state.difference.startedAt = null;
      state.difference.joined.clear();
      state.difference.submissions.clear();
    }
    if (body.activity === "all" || body.activity === "matrix") {
      state.matrix.startedAt = null;
      state.matrix.joined.clear();
      state.matrix.submissions.clear();
    }
    if (body.activity === "all" || body.activity === "fakeReal") {
      state.fakeReal.startedAt = null;
      state.fakeReal.joined.clear();
      state.fakeReal.submissions.clear();
    }
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/fake-real-items") {
    return json(res, 200, {
      items: state.fakeReal.items.map(({ id, src }) => ({ id, src })),
      total: state.fakeReal.items.length
    });
  }

  if (req.method === "GET" && url.pathname === "/api/matrix-puzzle") {
    return json(res, 200, { puzzle: matrixPuzzle(), target: MAGIC_TARGET, total: MAGIC_LINE_TOTAL });
  }

  if (req.method === "POST" && url.pathname === "/api/matrix-solution") {
    if (!requireHost(req, res)) return;
    const body = await readBody(req);
    if (!isValidMatrix(body.solution)) return json(res, 400, { error: "Expected a 3x3 solution grid" });
    const normalized = body.solution.map(row => row.map(v => Number(v)));
    if (!normalized.every(row => row.every(v => Number.isInteger(v) && v >= 1 && v <= 9))) {
      return json(res, 400, { error: "All solution cells must be digits 1-9" });
    }
    state.matrix.solution = normalized;
    state.matrix.joined.clear();
    state.matrix.submissions.clear();
    return json(res, 200, { ok: true, puzzle: matrixPuzzle() });
  }

  if (req.method === "POST" && url.pathname === "/api/submit-difference") {
    const body = await readBody(req);
    const found = Array.isArray(body.found) ? [...new Set(body.found.map(Number))] : [];
    const score = found.filter(n => Number.isInteger(n) && n >= 0 && n < 5).length;
    const timeMs = Math.max(0, Number(body.timeMs || 0));
    const key = participantKey(body);
    const entry = {
      name: cleanName(body.name),
      score,
      completed: score === 5,
      timeMs,
      submittedAt: Date.now()
    };
    const existing = state.difference.submissions.get(key);
    if (!existing || entry.score > existing.score || (entry.completed && entry.timeMs < existing.timeMs)) {
      state.difference.submissions.set(key, entry);
    }
    return json(res, 200, { ok: true, leaderboard: rankList("difference") });
  }

  if (req.method === "POST" && url.pathname === "/api/submit-matrix") {
    const body = await readBody(req);
    if (!isValidMatrix(body.grid)) return json(res, 400, { error: "Expected a 3x3 grid" });
    const result = scoreMagicSquare(body.grid);
    const timeMs = Math.max(0, Number(body.timeMs || 0));
    const key = participantKey(body);
    const entry = {
      name: cleanName(body.name),
      score: result.score,
      completed: result.completed,
      timeMs,
      submittedAt: Date.now()
    };
    const existing = state.matrix.submissions.get(key);
    if (!existing || entry.score > existing.score || (entry.completed && entry.timeMs < existing.timeMs)) {
      state.matrix.submissions.set(key, entry);
    }
    return json(res, 200, {
      ok: true,
      score: result.score,
      completed: result.completed,
      lineSums: result.lineSums,
      target: MAGIC_TARGET,
      leaderboard: rankList("matrix")
    });
  }

  if (req.method === "POST" && url.pathname === "/api/submit-fake-real") {
    const body = await readBody(req);
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const keyById = new Map(state.fakeReal.items.map(item => [item.id, item.answer]));
    let score = 0;
    for (const answer of answers) {
      const selected = String(answer.selected || "").toLowerCase();
      if (keyById.get(answer.id) === selected) score++;
    }
    const timeMs = Math.max(0, Number(body.timeMs || 0));
    const key = participantKey(body);
    const entry = {
      name: cleanName(body.name),
      score,
      completed: answers.length >= state.fakeReal.items.length,
      timeMs,
      submittedAt: Date.now()
    };
    const existing = state.fakeReal.submissions.get(key);
    if (!existing || entry.score > existing.score || (entry.score === existing.score && entry.timeMs < existing.timeMs)) {
      state.fakeReal.submissions.set(key, entry);
    }
    return json(res, 200, {
      ok: true,
      score,
      total: state.fakeReal.items.length,
      leaderboard: rankList("fakeReal")
    });
  }

  json(res, 404, { error: "API route not found" });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    api(req, res).catch(err => json(res, 500, { error: err.message }));
  } else {
    staticFile(req, res);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const addresses = localAddresses();
  console.log(`AI Minor Activities running on http://localhost:${PORT}`);
  if (addresses.length) console.log(`Phone access on same Wi-Fi: ${addresses.join(", ")}`);
});
