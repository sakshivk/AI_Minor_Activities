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
    const seconds = row.timeMs ? `${(row.timeMs / 1000).toFixed(1)}s` : "-";
    const li = document.createElement("li");
    li.innerHTML = `<span class="rank">${row.rank}</span><strong>${row.name}</strong><span class="score">${row.score}/${total} · ${seconds}</span>`;
    node.append(li);
  }
}

async function refresh() {
  const res = await fetch("/api/state");
  const data = await res.json();
  renderBoard("diffBoard", data.difference.leaderboard, 5);
  renderBoard("matrixBoard", data.matrix.leaderboard, 8);
  renderBoard("fakeRealBoard", data.fakeReal.leaderboard, 7);
}

refresh();
setInterval(refresh, 1500);
