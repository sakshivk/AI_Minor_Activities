const params = new URLSearchParams(location.search);
const requestedActivity = params.get("activity");
const activity = ["difference", "matrix", "fakeReal"].includes(requestedActivity) ? requestedActivity : "difference";
let forceQrView = false;
const meta = {
  difference: {
    title: "Find the Differences",
    label: "Activity 01",
    help: "Display this QR. Participants will see a waiting screen until you press Start.",
    path: "/play/difference",
    total: 5
  },
  matrix: {
    title: "Magic Matrix",
    label: "Activity 02",
    help: "Display this QR. Participants will see a waiting screen until you press Start.",
    path: "/play/matrix",
    total: 8
  },
  fakeReal: {
    title: "Fake or Real",
    label: "Activity 03",
    help: "Display this QR. Participants will join the waiting room, then swipe through the image cards after you press Start.",
    path: "/play/fake-real",
    total: 7
  }
}[activity];

function qrUrl(value) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=520x520&data=${encodeURIComponent(value)}`;
}

function renderBoard(node, rows, total) {
  node.innerHTML = "";
  if (!rows.length) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="rank">-</span><strong>Waiting for submissions</strong><span class="score">0/${total}</span>`;
    node.append(li);
    return;
  }
  for (const row of rows.slice(0, 10)) {
    const seconds = row.timeMs ? `${(row.timeMs / 1000).toFixed(1)}s` : "-";
    const li = document.createElement("li");
    li.innerHTML = `<span class="rank">${row.rank}</span><strong>${row.name}</strong><span class="score">${row.score}/${total} · ${seconds}</span>`;
    node.append(li);
  }
}

function renderJoined(rows) {
  const node = document.getElementById("joinedList");
  node.innerHTML = "";
  if (!rows.length) {
    const li = document.createElement("li");
    li.textContent = "Waiting for participants to join";
    node.append(li);
    return;
  }
  for (const row of rows.slice(0, 18)) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${row.number}</span><strong>${row.name}</strong>`;
    node.append(li);
  }
}

async function setQr() {
  const res = await fetch("/api/config");
  const config = await res.json();
  const base = config.baseUrl || location.origin;
  const playUrl = `${base}${meta.path}`;
  document.getElementById("activityUrl").textContent = playUrl;
  document.getElementById("activityQr").src = qrUrl(playUrl);
}

async function refresh() {
  const res = await fetch("/api/state");
  const state = await res.json();
  const rows = state[activity].leaderboard;
  const started = Boolean(state[activity].startedAt);
  const joined = state[activity].joined || [];
  document.getElementById("activityHelp").textContent = started
    ? "Activity is live. Participants can play now."
    : meta.help;
  document.getElementById("startActivity").textContent = started ? "Restart Activity" : "Start Activity";
  document.getElementById("hostJoinedCount").textContent = state[activity].joinedCount || 0;
  renderJoined(joined);
  document.getElementById("qrStage").hidden = started && !forceQrView;
  document.getElementById("setupPanel").hidden = started && !forceQrView;
  document.getElementById("gameLiveScreen").hidden = !started || forceQrView;
  renderBoard(document.getElementById("board"), rows, meta.total);
}

document.getElementById("activityLabel").textContent = meta.label;
document.getElementById("activityTitle").textContent = meta.title;
document.getElementById("liveTitle").textContent = meta.title;
document.getElementById("boardTitle").textContent = `${meta.title} Leaderboard`;
document.getElementById("matrixAdmin").hidden = activity !== "matrix";

document.getElementById("startActivity").addEventListener("click", async () => {
  forceQrView = false;
  await fetch("/api/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activity })
  });
  refresh();
});

document.getElementById("resetActivity").addEventListener("click", async () => {
  forceQrView = false;
  await fetch("/api/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activity })
  });
  refresh();
});

document.getElementById("backToQr").addEventListener("click", () => {
  forceQrView = true;
  document.getElementById("qrStage").hidden = false;
  document.getElementById("setupPanel").hidden = false;
  document.getElementById("gameLiveScreen").hidden = true;
});

document.getElementById("resetFromLive").addEventListener("click", async () => {
  forceQrView = false;
  await fetch("/api/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activity })
  });
  refresh();
});

document.getElementById("saveSolution")?.addEventListener("click", async () => {
  const raw = document.getElementById("solutionInput").value.trim().split(/\n+/);
  const solution = raw.map(line => line.replace(/[^1-9]/g, "").split("").map(Number));
  const status = document.getElementById("solutionStatus");
  if (solution.length !== 3 || solution.some(row => row.length !== 3)) {
    status.textContent = "Use exactly 3 rows with 3 digits each.";
    return;
  }
  const res = await fetch("/api/matrix-solution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ solution })
  });
  const data = await res.json();
  status.textContent = data.ok ? "Saved. Matrix leaderboard reset." : data.error;
  refresh();
});

setQr();
refresh();
setInterval(refresh, 1500);
