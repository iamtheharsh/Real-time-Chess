import axios from "axios";

// Axios instance — all requests go through here
// The Vite proxy forwards /api → http://localhost:5000
const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL
    ? `${import.meta.env.VITE_SERVER_URL}/api`
    : "/api",
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
