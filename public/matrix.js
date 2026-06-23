const matrix = document.getElementById("matrix");
const MATRIX_SIZE = 3;
const MAGIC_LINE_TOTAL = 8;
let target = 15;
let puzzle = [];
let startedAt = 0;
let hostStartedAt = null;
let hasJoined = false;

function getDeviceId() {
  const existing = localStorage.getItem("aiMinorDeviceId");
  if (existing) return existing;
  const generated = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem("aiMinorDeviceId", generated);
  return generated;
}

const deviceId = getDeviceId();

async function loadPuzzle() {
  const res = await fetch("/api/matrix-puzzle");
  const data = await res.json();
  puzzle = data.puzzle;
  target = data.target || 15;
  document.getElementById("targetSum").textContent = target;
  renderPuzzle(false);
}

function renderPuzzle(active) {
  matrix.innerHTML = "";
  for (let r = 0; r < MATRIX_SIZE; r++) {
    for (let c = 0; c < MATRIX_SIZE; c++) {
      const input = document.createElement("input");
      input.className = "cell";
      input.inputMode = "numeric";
      input.maxLength = 1;
      input.dataset.r = r;
      input.dataset.c = c;
      const value = puzzle[r][c];
      if (value) {
        input.value = value;
        input.readOnly = true;
        input.classList.add("given");
      } else {
        input.disabled = !active;
        input.addEventListener("input", () => {
          input.value = input.value.replace(/[^1-9]/g, "").slice(0, 1);
        });
      }
      matrix.append(input);
    }
  }
}

function beginGame(serverStartedAt) {
  if (hostStartedAt === serverStartedAt) return;
  if (!hasJoined) return;
  hostStartedAt = serverStartedAt;
  startedAt = Date.now();
  document.getElementById("waiting").hidden = true;
  document.getElementById("game").hidden = false;
  renderPuzzle(true);
  document.getElementById("submit").disabled = false;
  document.getElementById("status").textContent = "Activity started. Fill all missing cells and submit.";
}

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
    body: JSON.stringify({ activity: "matrix", name, deviceId })
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

function collectGrid() {
  const grid = Array.from({ length: MATRIX_SIZE }, () => Array(MATRIX_SIZE).fill(0));
  matrix.querySelectorAll(".cell").forEach(cell => {
    grid[Number(cell.dataset.r)][Number(cell.dataset.c)] = Number(cell.value || 0);
  });
  return grid;
}

document.getElementById("submit").addEventListener("click", async () => {
  if (!startedAt) return;
  const timeMs = Date.now() - startedAt;
  const res = await fetch("/api/submit-matrix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: document.getElementById("name").value,
      deviceId,
      grid: collectGrid(),
      timeMs
    })
  });
  const data = await res.json();
  document.getElementById("status").textContent = data.completed
    ? `All 8 lines match ${data.target}. Submitted in ${(timeMs / 1000).toFixed(1)} seconds.`
    : `${data.score}/${MAGIC_LINE_TOTAL} lines match ${data.target}. Check rows, columns, and diagonals.`;
  refreshBoard();
});

function renderBoard(rows) {
  const board = document.getElementById("board");
  board.innerHTML = "";
  for (const row of rows.slice(0, 10)) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="rank">${row.rank}</span><strong>${row.name}</strong><span class="score">${row.score}/${MAGIC_LINE_TOTAL} · ${(row.timeMs / 1000).toFixed(1)}s</span>`;
    board.append(li);
  }
}

async function refreshBoard() {
  const res = await fetch("/api/state");
  const data = await res.json();
  document.getElementById("joinedCount").textContent = data.matrix.joinedCount || 0;
  if (data.matrix.startedAt && hasJoined) {
    beginGame(data.matrix.startedAt);
  } else {
    document.getElementById("waiting").hidden = false;
    document.getElementById("game").hidden = true;
    hostStartedAt = null;
    startedAt = 0;
  }
  renderBoard(data.matrix.leaderboard);
}

loadPuzzle();
refreshBoard();
setInterval(refreshBoard, 1500);
