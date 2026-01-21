import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthProvider";
import useLangMenu from "../../shared/useLangMenu";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/board", label: "Board" },
  { to: "/motionGuide", label: "Motion Guide" },
  { to: "/download", label: "Download" },
];

export default function AppHeader() {
  const { user, isAuthed, logout } = useAuth();
  const nav = useNavigate();

  const { t } = useTranslation(["header", "board"]);
  const { LANGUAGES, isLangOpen, setIsLangOpen, currentLang, selectLang } =
    useLangMenu();

  const onLogout = async () => {
    await logout();
    nav("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface-soft)]/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="text-lg tracking-tight text-white hover:text-[var(--accent)] transition-colors"
          >
            Gesture OS Manager
          </Link>

          <nav className="flex items-center gap-2 lg:hidden">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-1.5 text-xs transition-all ${
                    isActive
                      ? "bg-[var(--accent)]/20 text-white"
                      : "text-[var(--muted)] hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* 언어 드롭다운 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                console.log("[LangMenu] toggle click", { isLangOpen });
                setIsLangOpen((v) => !v);
              }}
              className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2 text-xs text-[var(--muted)] hover:text-white transition-all"
            >
              <svg
                className="w-4 h-4 text-[var(--accent)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
              </svg>

              {currentLang}

              <svg
                className={`w-4 h-4 transition-transform ${isLangOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isLangOpen && (
              <div className="absolute top-full right-0 mt-2 w-40 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[0_18px_40px_rgba(6,12,26,0.55)] z-50">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      console.log("[LangMenu] select click", lang.code);
                      selectLang(lang.code);
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs text-[var(--muted)] hover:text-white hover:bg-[rgba(59,130,246,0.15)] transition-all"
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-6 w-[1px] bg-[var(--border)] mx-2"></div>

          {!isAuthed ? (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)] hover:text-white transition-all"
              >
                {t("header:auth.login")}
              </Link>
              <Link
                to="/join"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)] hover:bg-[var(--accent-strong)] transition-all"
              >
                {t("header:auth.join")}
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/mypage"
                className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white transition-all"
              >
                <div className="h-7 w-7 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>{user?.nickname || user?.name}</span>
              </Link>

              <button
                type="button"
                onClick={onLogout}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)] hover:text-white transition-all"
              >
                {t("header:auth.logout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
