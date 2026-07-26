import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../lib/api";
import { disconnectSocket } from "../lib/socket";
import { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("dw_access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.data))
      .catch(() => {
        localStorage.removeItem("dw_access_token");
        localStorage.removeItem("dw_refresh_token");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    const { accessToken, refreshToken, user: loggedInUser } = res.data.data;
    localStorage.setItem("dw_access_token", accessToken);
    localStorage.setItem("dw_refresh_token", refreshToken);
    setUser(loggedInUser);
  }

  function logout() {
    localStorage.removeItem("dw_access_token");
    localStorage.removeItem("dw_refresh_token");
    disconnectSocket();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
