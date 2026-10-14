import axios from "axios";

// Helper to determine clean API baseURL
const getBaseURL = () => {
  const rawUrl = import.meta.env.VITE_SERVER_URL;
  if (!rawUrl) return "/api";
  const cleanUrl = rawUrl.replace(/\/+$/, "");
  // If user already included /api at the end, don't duplicate it
  return cleanUrl.endsWith("/api") ? cleanUrl : `${cleanUrl}/api`;
};

// Axios instance — all requests go through here
const api = axios.create({
  baseURL: getBaseURL(),
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: attach JWT token to every request automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("chess_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: if we get a 401, clear storage and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("chess_token");
      localStorage.removeItem("chess_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
