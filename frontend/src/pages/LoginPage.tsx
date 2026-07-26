import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const DEMO_ACCOUNTS = [
  "platform@deploywatch.dev",
  "sre@deploywatch.dev",
  "devops@deploywatch.dev",
  "manager@deploywatch.dev",
  "exec@deploywatch.dev",
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("platform@deploywatch.dev");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Invalid credentials. Run `npm run seed` in the backend if you haven't yet.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#0b0f14]">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-[#3ecf8e]" />
          <span className="text-lg font-bold text-slate-100">DeployWatch</span>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[#1f2731] bg-[#0b0f14] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#3ecf8e]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[#1f2731] bg-[#0b0f14] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#3ecf8e]"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-[#3ecf8e] py-2 text-sm font-semibold text-[#0b0f14] disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          Demo accounts (password: <code>password123</code>): each maps to a different role dashboard —{" "}
          {DEMO_ACCOUNTS.join(", ")}.
        </p>
      </div>
    </div>
  );
}
