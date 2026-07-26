import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../lib/socket";
import { LiveIndicator } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/clusters", label: "Clusters" },
  { to: "/incidents", label: "Incidents" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return (
    <div className="flex h-screen bg-[#0b0f14]">
      <aside className="flex w-56 flex-col border-r border-[#1f2731] bg-[#0d1218] px-3 py-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="h-6 w-6 rounded bg-[#3ecf8e]" />
          <span className="text-sm font-bold tracking-tight text-slate-100">DeployWatch</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#1a212b] text-slate-100"
                    : "text-slate-400 hover:bg-[#141a22] hover:text-slate-200"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 px-2">
          <LiveIndicator connected={connected} />
          <div className="text-xs text-slate-500">
            <p className="font-medium text-slate-300">{user?.name}</p>
            <p className="capitalize">{user?.role.replace(/_/g, " ")}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="mt-1 rounded-md border border-[#1f2731] px-2 py-1 text-left text-xs text-slate-400 hover:text-slate-200"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
