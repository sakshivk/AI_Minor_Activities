let items = [];
let index = 0;
let answers = [];
let startedAt = 0;
let hostStartedAt = null;
let hasJoined = false;
let startX = 0;
let currentX = 0;
let dragging = false;

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
const card = document.getElementById("card");
const image = document.getElementById("gameImage");

async function loadItems() {
  const res = await fetch("/api/fake-real-items");
  const data = await res.json();
  items = data.items || [];
  renderCard();
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
    body: JSON.stringify({ activity: "fakeReal", name, deviceId })
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

function renderCard() {
  if (!items.length) return;
  const current = items[index];
  image.src = current.src;
  document.getElementById("progress").textContent = `Image ${index + 1}/${items.length}`;
  card.style.transform = "translateX(0) rotate(0deg)";
}

function answer(selected) {
  if (!startedAt || !items[index]) return;
  answers.push({ id: items[index].id, selected });
  index++;
  if (index >= items.length) {
    submitAnswers();
  } else {
    renderCard();
    document.getElementById("status").textContent = "Next image.";
  }
}

async function submitAnswers() {
  const timeMs = Date.now() - startedAt;
  const res = await fetch("/api/submit-fake-real", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: document.getElementById("name").value,
      deviceId,
      answers,
      timeMs
    })
  });
  const data = await res.json();
  document.getElementById("status").textContent = `Submitted: ${data.score}/${data.total} correct in ${(timeMs / 1000).toFixed(1)} seconds.`;
  document.querySelector(".swipe-actions").hidden = true;
  card.hidden = true;
  refreshBoard();
}

function beginGame(serverStartedAt) {
  if (hostStartedAt === serverStartedAt) return;
  if (!hasJoined) return;
  hostStartedAt = serverStartedAt;
  startedAt = Date.now();
  index = 0;
  answers = [];
  document.getElementById("waiting").hidden = true;
  document.getElementById("game").hidden = false;
  document.querySelector(".swipe-actions").hidden = false;
  card.hidden = false;
  document.getElementById("status").textContent = "Swipe or tap Fake/Real.";
  renderCard();
}

function renderBoard(rows) {
  const board = document.getElementById("board");
  board.innerHTML = "";
  for (const row of rows.slice(0, 10)) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="rank">${row.rank}</span><strong>${row.name}</strong><span class="score">${row.score}/${items.length || 7} · ${(row.timeMs / 1000).toFixed(1)}s</span>`;
    board.append(li);
  }
}

async function refreshBoard() {
  const res = await fetch("/api/state");
  const data = await res.json();
  document.getElementById("joinedCount").textContent = data.fakeReal.joinedCount || 0;
  if (data.fakeReal.startedAt && hasJoined) {
    beginGame(data.fakeReal.startedAt);
  } else {
    document.getElementById("waiting").hidden = false;
    document.getElementById("game").hidden = true;
    hostStartedAt = null;
    startedAt = 0;
  }
  renderBoard(data.fakeReal.leaderboard);
}

card.addEventListener("pointerdown", event => {
  if (!startedAt) return;
  dragging = true;
  startX = event.clientX;
  currentX = event.clientX;
  card.setPointerCapture(event.pointerId);
});

card.addEventListener("pointermove", event => {
  if (!dragging) return;
  currentX = event.clientX;
  const dx = currentX - startX;
  card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
});

card.addEventListener("pointerup", () => {
  if (!dragging) return;
  dragging = false;
  const dx = currentX - startX;
  if (dx > 90) {
    answer("real");
  } else if (dx < -90) {
    answer("fake");
  } else {
    card.style.transform = "translateX(0) rotate(0deg)";
  }
});

document.getElementById("join").addEventListener("click", joinActivity);
document.getElementById("fakeBtn").addEventListener("click", () => answer("fake"));
document.getElementById("realBtn").addEventListener("click", () => answer("real"));

loadItems();
refreshBoard();
setInterval(refreshBoard, 1500);
