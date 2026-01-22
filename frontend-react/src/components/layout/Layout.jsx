// src/components/layout/Layout.jsx
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Layout() {
  const nav = useNavigate();
  const loc = useLocation();

  const items = [
    { label: "홈", path: "/" },
    { label: "소개", path: "/about" },
    { label: "게시판", path: "/board" },
    { label: "모션 가이드", path: "/motionGuide" },
    { label: "다운로드", path: "/download" },
  ];

  return (
    <div className="min-h-screen app-bg text-[color:var(--text)]">
      <AppHeader />

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-[240px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="glass-soft p-3">
            <nav className="space-y-2">
              {items.map((it) => {
                const active = loc.pathname === it.path || (it.path !== "/" && loc.pathname.startsWith(it.path));
                return (
                  <button
                    key={it.path}
                    onClick={() => nav(it.path)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition",
                      active
                        ? "bg-[color:var(--surface)] border border-[color:var(--border)]"
                        : "hover:bg-[color:var(--surface)]"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        active ? "bg-[color:var(--accent)]" : "bg-[color:var(--border)]"
                      )}
                    />
                    <span className={cn("text-sm", active ? "text-[color:var(--text)]" : "text-[color:var(--muted)]")}>
                      {it.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <main className="min-h-[calc(100vh-140px)]">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
