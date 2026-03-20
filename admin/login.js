(function () {
  const form = document.getElementById("adminLoginForm");
  const feedback = document.getElementById("loginFeedback");

  function setFeedback(message, isError) {
    if (!feedback) return;
    feedback.textContent = message || "";
    feedback.classList.toggle("is-error", !!isError);
  }

  function adminServerHint() {
    return "Apri la dashboard tramite `python3 server.py` e visita http://127.0.0.1:8000/admin/login.html.";
  }

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  async function checkSession() {
    try {
      if (window.location.protocol === "file:") return;
      const res = await fetch("/api/admin/session", { credentials: "same-origin" });
      const data = await res.json();
      if (data && data.authenticated) {
        window.location.href = "./dashboard.html";
      }
    } catch {
      setFeedback(adminServerHint(), true);
    }
  }

  if (!form) {
    checkSession();
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback("Accesso in corso…", false);

    const payload = {
      username: form.username.value.trim(),
      password: form.password.value,
    };

    try {
      if (window.location.protocol === "file:") {
        throw new Error(adminServerHint());
      }
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await readJsonSafe(res);
        if (res.status === 401 && data.error === "invalid_credentials") {
          setFeedback("Credenziali non valide.", true);
          return;
        }
        if (res.status === 404) {
          setFeedback("Il server in ascolto non espone le API admin corrette. Riavvia `python3 server.py`.", true);
          return;
        }
        setFeedback(data.error || "Login non riuscito per un errore del server admin.", true);
        return;
      }

      window.location.href = "./dashboard.html";
    } catch (error) {
      setFeedback(error.message || "Server admin non raggiungibile. Avvia `python3 server.py`.", true);
    }
  });

  checkSession();
})();
