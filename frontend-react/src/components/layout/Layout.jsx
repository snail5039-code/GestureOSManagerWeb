import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppHeader from "./AppHeader";
import ChatWidget from "../help/ChatWidget";
import { useAuth } from "../../auth/AuthProvider";

export default function Layout() {
  const { isAuthed } = useAuth();
  const { t } = useTranslation(["layout"]); // ✅ layout 네임스페이스

  const navItems = [
    { to: "/", key: "home" },
    { to: "/about", key: "about" },
    { to: "/board", key: "board" },
    { to: "/motionGuide", key: "motionGuide" },
    { to: "/download", key: "download" },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(30,58,138,0.35),_transparent_50%),radial-gradient(circle_at_bottom,_rgba(8,47,73,0.35),_transparent_55%),linear-gradient(180deg,_var(--bg)_0%,_var(--bg-deep)_100%)]">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-72 flex-col border-r border-[var(--border)] bg-[var(--surface-soft)]/70 backdrop-blur-xl">
          <div className="px-6 py-6">
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] px-4 py-3 shadow-[0_10px_30px_rgba(6,12,26,0.55)]">
              <div className="h-10 w-10 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.4}
                    d="M12 6v12m6-6H6"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm text-[var(--muted)]">
                  {t("layout:sidebar.subtitle")}
                </div>
                <div className="text-lg tracking-tight">
                  {t("layout:sidebar.title")}
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${
                    isActive
                      ? "bg-[var(--surface)] text-white shadow-[0_12px_28px_rgba(6,12,26,0.5)]"
                      : "text-[var(--muted)] hover:text-white hover:bg-[rgba(59,130,246,0.12)]"
                  }`
                }
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]/70"></span>
                <span className="text-sm">{t(`layout:nav.${item.key}`)}</span>
              </NavLink>
            ))}
          </nav>

          <div className="px-6 pb-6 pt-2 text-xs text-[var(--muted)]">
            {isAuthed ? t("layout:status.signedIn") : t("layout:status.guest")}
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 px-6 py-6 lg:px-10">
            <Outlet />
          </main>
        </div>
      </div>

      <ChatWidget />
    </div>
  );
}
