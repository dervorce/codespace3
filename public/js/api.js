/* Small fetch wrapper: attaches the JWT, throws on non-2xx with the server's error message. */
const API_BASE = (() => {
  const host = window.location.hostname;
  const isLocal =
    window.location.protocol === "file:" ||
    host === "localhost" ||
    host === "127.0.0.1";
  if (isLocal) {
    return "http://127.0.0.1:4000/api";
  }
  return `${window.location.origin}/api`;
})();

function getToken() {
  return localStorage.getItem("token");
}
function setSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
function requireLogin() {
  if (!getToken()) {
    window.location.href = "/login.html";
  }
}

async function api(path, { method = "GET", body, isFormData = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData && body !== undefined)
    headers["Content-Type"] = "application/json";

  const url = API_BASE + path;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(
      `Network error: could not reach API server at ${url}. ${err.message}`,
    );
  }

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no body */
  }

  if (!res.ok) {
    const message =
      data && data.error ? data.error : `Request failed (${res.status})`;
    if (res.status === 401) {
      clearSession();
      window.location.href = "/login.html";
    }
    throw new Error(message);
  }
  return data;
}
