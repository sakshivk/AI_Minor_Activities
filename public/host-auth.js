document.getElementById("logoutHost")?.addEventListener("click", async () => {
  await fetch("/api/host-logout", { method: "POST" });
  location.href = "/";
});
