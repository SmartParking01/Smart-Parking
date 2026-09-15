// Cambia esta URL si el backend corre en otra dirección/puerto.
const API_BASE_URL = "http://localhost:4000/api";

const Api = {
  getToken() { return localStorage.getItem("sp_token"); },
  setToken(token) { localStorage.setItem("sp_token", token); },
  clearToken() { localStorage.removeItem("sp_token"); },

  async request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = this.getToken();

    if (!token) {
      window.location.hash = "#/login";
      throw new Error("Sesión expirada.");
    }
    headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      throw new Error("No se pudo conectar con el servidor.");
    }

    // 401 → token inválido o expirado → limpia y manda al login
    if (res.status === 401) {
      this.clearToken();
      window.location.hash = "#/login";
      throw new Error("Token inválido o expirado.");
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = { success: false, message: "Respuesta inválida del servidor." };
    }

    if (!res.ok || data.success === false) {
      throw new Error(data.message || "Ocurrió un error inesperado.");
    }
    return data;
  },

  get(path) { return this.request("GET", path); },
  post(path, body) { return this.request("POST", path, body); },
  put(path, body) { return this.request("PUT", path, body); },
  patch(path, body) { return this.request("PATCH", path, body); },
  delete(path) { return this.request("DELETE", path); },
};