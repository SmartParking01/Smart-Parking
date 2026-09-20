// =============================================================================
// Login unificado — detecta el rol y redirige al frontend correcto.
// =============================================================================

const API_BASE_URL = "http://localhost:4000/api";

const form      = document.getElementById("login-form");
const emailEl   = document.getElementById("email");
const passEl    = document.getElementById("password");
const errEl     = document.getElementById("error");
const submitBtn = document.getElementById("submit-btn");
const btnLabel  = document.getElementById("btn-label");
const btnSpin   = document.getElementById("btn-spinner");

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnLabel.textContent = loading ? "Verificando…" : "Iniciar sesión";
  btnSpin.hidden = !loading;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.textContent = "";

  const email = emailEl.value.trim();
  const password = passEl.value;

  if (!email || !password) {
    errEl.textContent = "Ingresa tu correo y contraseña.";
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.success === false) {
      throw new Error(data.message || "No se pudo iniciar sesión.");
    }

    const role  = data.user?.role;
    const token = data.token;
    if (!role || !token) throw new Error("Respuesta inválida del servidor.");

    // Guarda el token en la clave correcta según el rol y redirige
    if (role === "ADMIN" || role === "ATTENDANT") {
      localStorage.setItem("sp_admin_token", token);
      window.location.href = "../frontend-admin/index.html#/dashboard";
    } else if (role === "USER") {
      localStorage.setItem("sp_token", token);
      window.location.href = "../frontend-user/index.html#/home";
    } else {
      throw new Error("Tu cuenta no tiene un rol válido.");
    }
  } catch (err) {
    errEl.textContent = err.message;
    setLoading(false);
  }
});