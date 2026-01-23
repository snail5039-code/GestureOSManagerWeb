// src/components/layout/Layout.jsx
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import { useTranslation } from "react-i18next";
import ChatWidget from "../help/ChatWidget";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Layout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { t } = useTranslation("layout"); // ✅ nav가 들어있는 네임스페이스

  const items = [
    { key: "home", path: "/" },
    { key: "about", path: "/about" },
    { key: "board", path: "/board" },
    { key: "motionGuide", path: "/motionGuide" },
    { key: "download", path: "/download" },
  ];

  return (
    <div className="min-h-screen app-bg text-[color:var(--text)]">
      <AppHeader />

      {/* ✅ 사이드바는 왼쪽에 고정 배치, 콘텐츠는 기존처럼 가운데 컨테이너 유지 */}
      <div className="w-full py-6">
        <div className="flex gap-6">
          {/* Sidebar (왼쪽에 붙음) */}
          <aside className="w-[240px] shrink-0 glass-soft p-3">
            <nav className="space-y-2">
              {items.map((it) => {
                const active =
                  loc.pathname === it.path ||
                  (it.path !== "/" && loc.pathname.startsWith(it.path));

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
                    <span
                      className={cn(
                        "text-sm",
                        active ? "text-[color:var(--text)]" : "text-[color:var(--muted)]"
                      )}
                    >
                      {t(`nav.${it.key}`)}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content (기존처럼 가운데 폭 제한 유지) */}
          <main className="flex-1 min-h-[calc(100vh-140px)]">
            <div className="mx-auto max-w-[1400px] px-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <ChatWidget />
    </div>
  );
}
