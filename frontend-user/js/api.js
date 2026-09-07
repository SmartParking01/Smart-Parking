// Cambia esta URL si el backend corre en otra dirección/puerto.
const API_BASE_URL = "http://localhost:4000";

const Api = {
  getToken() {
    return localStorage.getItem("sp_token");
  },
  setToken(token) {
    localStorage.setItem("sp_token", token);
  },
  clearToken() {
    localStorage.removeItem("sp_token");
  },

  async request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

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
};
