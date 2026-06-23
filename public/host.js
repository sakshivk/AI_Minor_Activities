let diffUrl = `${location.origin}/play/difference`;
let matrixUrl = `${location.origin}/play/matrix`;

function qrUrl(value) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(value)}`;
}

function setQrUrls(baseUrl) {
  diffUrl = `${baseUrl}/play/difference`;
  matrixUrl = `${baseUrl}/play/matrix`;
  document.getElementById("diffUrl").textContent = diffUrl;
  document.getElementById("matrixUrl").textContent = matrixUrl;
  document.getElementById("diffQr").src = qrUrl(diffUrl);
  document.getElementById("matrixQr").src = qrUrl(matrixUrl);
}

function renderBoard(id, rows, total) {
  const node = document.getElementById(id);
  node.innerHTML = "";
  if (!rows.length) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="rank">-</span><strong>No submissions yet</strong><span class="score">waiting</span>`;
    node.append(li);
    return;
  }
  for (const row of rows.slice(0, 10)) {
    const li = document.createElement("li");
    const seconds = row.timeMs ? `${(row.timeMs / 1000).toFixed(1)}s` : "-";
    li.innerHTML = `<span class="rank">${row.rank}</span><strong>${row.name}</strong><span class="score">${row.score}/${total} · ${seconds}</span>`;
    node.append(li);
  }
}

async function refresh() {
  const res = await fetch("/api/state");
  const data = await res.json();
  renderBoard("diffBoard", data.difference.leaderboard, 5);
  renderBoard("matrixBoard", data.matrix.leaderboard, 8);
}

document.querySelectorAll("[data-start]").forEach(button => {
  button.addEventListener("click", async () => {
    await fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activity: button.dataset.start })
    });
    refresh();
  });
});

document.getElementById("saveSolution").addEventListener("click", async () => {
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

fetch("/api/config")
  .then(res => res.json())
  .then(config => setQrUrls(config.baseUrl || location.origin))
  .catch(() => setQrUrls(location.origin));

refresh();
setInterval(refresh, 1500);
