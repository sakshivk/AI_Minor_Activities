document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const status = document.getElementById("loginStatus");
  const pin = document.getElementById("pin").value;
  const res = await fetch("/api/host-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin })
  });
  const data = await res.json();
  if (!data.ok) {
    status.textContent = data.error || "Could not unlock host controls.";
    return;
  }
  location.href = "/";
});
