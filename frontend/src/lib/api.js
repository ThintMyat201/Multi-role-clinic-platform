import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = "honeybee_token";

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
});

// attach Authorization header from localStorage on every request
api.interceptors.request.use((config) => {
  const tok = localStorage.getItem(TOKEN_KEY);
  if (tok) config.headers.Authorization = `Bearer ${tok}`;
  return config;
});

export function setAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  }
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
