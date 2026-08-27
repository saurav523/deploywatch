import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { disconnectSocket } from "../lib/socket";
import { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const DEMO_USER: User = {
  id: "demo-user-1",
  email: "platform@deploywatch.dev",
  name: "Priya (Platform Engineer)",
  role: "platform_engineer",
  orgId: "demo-org-1",
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const demoLoggedIn = localStorage.getItem("dw_demo_logged_in");

    if (demoLoggedIn === "true") {
      setUser(DEMO_USER);
    }

    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    // Demo-only authentication.
    // No backend or database is required.
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    localStorage.setItem("dw_demo_logged_in", "true");
    localStorage.setItem("dw_access_token", "demo-access-token");

    setUser({
      ...DEMO_USER,
      email,
    });
  }

  function logout() {
    localStorage.removeItem("dw_demo_logged_in");
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

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
}
