const left = document.getElementById("left");
const right = document.getElementById("right");
const lctx = left.getContext("2d");
const rctx = right.getContext("2d");
const found = new Set();
let startedAt = 0;
let hostStartedAt = null;
let hasJoined = false;
let imagesReady = false;

function getDeviceId() {
  const existing = localStorage.getItem("viActivitiesDeviceId");
  if (existing) return existing;
  const legacy = localStorage.getItem("aiMinorDeviceId");
  if (legacy) {
    localStorage.setItem("viActivitiesDeviceId", legacy);
    return legacy;
  }
  const generated = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem("viActivitiesDeviceId", generated);
  return generated;
}

const deviceId = getDeviceId();

const originalImage = new Image();
const modifiedImage = new Image();
originalImage.src = "/assets/difference-original.png";
modifiedImage.src = "/assets/difference-modified.png";

const hotspots = [
  { id: 0, x: 278, y: 238, r: 85, label: "gear icon" },
  { id: 1, x: 1288, y: 828, r: 95, label: "robot chest" },
  { id: 2, x: 1680, y: 750, r: 185, label: "plant and pot" },
  { id: 3, x: 2460, y: 500, r: 160, label: "graduation year" },
  { id: 4, x: 1650, y: 1210, r: 160, label: "laptop screen" }
];

function drawImagePair() {
  lctx.clearRect(0, 0, left.width, left.height);
  rctx.clearRect(0, 0, right.width, right.height);
  if (!imagesReady) {
    lctx.fillStyle = "#eef4f1";
    rctx.fillStyle = "#eef4f1";
    lctx.fillRect(0, 0, left.width, left.height);
    rctx.fillRect(0, 0, right.width, right.height);
    lctx.fillStyle = "#18201f";
    rctx.fillStyle = "#18201f";
    lctx.font = "72px sans-serif";
    rctx.font = "72px sans-serif";
    lctx.fillText("Loading image...", 100, 160);
    rctx.fillText("Loading image...", 100, 160);
    return;
  }
  lctx.drawImage(originalImage, 0, 0, left.width, left.height);
  rctx.drawImage(modifiedImage, 0, 0, right.width, right.height);
  for (const h of found) {
    const spot = hotspots[h];
    rctx.strokeStyle = "#ff2d2d";
    rctx.lineWidth = 14;
    rctx.beginPath();
    rctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
    rctx.stroke();
    rctx.fillStyle = "rgba(255, 45, 45, 0.16)";
    rctx.beginPath();
    rctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
    rctx.fill();
  }
}

function redraw() {
  drawImagePair();
}

function getPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

right.addEventListener("click", event => {
  if (!startedAt) return;
  const p = getPoint(right, event);
  const hit = hotspots.find(h => Math.hypot(h.x - p.x, h.y - p.y) <= h.r);
  if (hit) {
    found.add(hit.id);
    redraw();
    document.getElementById("status").textContent = `${found.size}/5 differences found.`;
    if (found.size === 5) document.getElementById("submit").disabled = false;
  }
});

async function joinActivity() {
  const name = document.getElementById("name").value.trim();
  const status = document.getElementById("joinStatus");
  if (!name) {
    status.textContent = "Please enter your name before joining.";
    return;
  }
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activity: "difference", name, deviceId })
  });
  const data = await res.json();
  hasJoined = Boolean(data.ok);
  document.getElementById("name").readOnly = hasJoined;
  document.getElementById("join").disabled = hasJoined;
  status.textContent = hasJoined
    ? "You have joined. Keep this page open until the host starts."
    : data.error || "Could not join.";
  document.getElementById("joinedCount").textContent = data.joinedCount || 0;
}

document.getElementById("join").addEventListener("click", joinActivity);

function beginGame(serverStartedAt) {
  if (hostStartedAt === serverStartedAt) return;
  if (!hasJoined) return;
  hostStartedAt = serverStartedAt;
  found.clear();
  startedAt = Date.now();
  document.getElementById("submit").disabled = true;
  document.getElementById("waiting").hidden = true;
  document.getElementById("game").hidden = false;
  document.getElementById("status").textContent = "Activity started. Tap the differences on the right image.";
  redraw();
}

document.getElementById("submit").addEventListener("click", async () => {
  const name = document.getElementById("name").value;
  const timeMs = Date.now() - startedAt;
  const res = await fetch("/api/submit-difference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, deviceId, found: [...found], timeMs })
  });
  await res.json();
  document.getElementById("status").textContent = `Submitted in ${(timeMs / 1000).toFixed(1)} seconds.`;
  refreshBoard();
});

function renderBoard(rows) {
  const board = document.getElementById("board");
  board.innerHTML = "";
  for (const row of rows.slice(0, 10)) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="rank">${row.rank}</span><strong>${row.name}</strong><span class="score">${row.score}/5 · ${(row.timeMs / 1000).toFixed(1)}s</span>`;
    board.append(li);
  }
}

async function refreshBoard() {
  const res = await fetch("/api/state");
  const data = await res.json();
  document.getElementById("joinedCount").textContent = data.difference.joinedCount || 0;
  if (data.difference.startedAt && hasJoined) {
    beginGame(data.difference.startedAt);
  } else {
    document.getElementById("waiting").hidden = false;
    document.getElementById("game").hidden = true;
    hostStartedAt = null;
    startedAt = 0;
  }
  renderBoard(data.difference.leaderboard);
}

redraw();
Promise.all([
  originalImage.decode(),
  modifiedImage.decode()
]).then(() => {
  imagesReady = true;
  redraw();
}).catch(() => {
  document.getElementById("status").textContent = "Could not load the activity images.";
});
refreshBoard();
setInterval(refreshBoard, 1500);
