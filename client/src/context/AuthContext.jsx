import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

// AuthProvider wraps the entire app and exposes auth state + actions
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we verify stored token on mount

  // On mount: if there's a token in localStorage, verify it with /api/auth/me
  // This keeps the user logged in across page refreshes
  useEffect(() => {
    const token = localStorage.getItem("chess_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => {
        // Token is invalid or expired — clean up
        localStorage.removeItem("chess_token");
        localStorage.removeItem("chess_user");
      })
      .finally(() => setLoading(false));
  }, []);

  const register = async (username, email, password) => {
    const res = await api.post("/auth/register", { username, email, password });
    localStorage.setItem("chess_token", res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("chess_token", res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("chess_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — components use: const { user, login, logout } = useAuth()
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
