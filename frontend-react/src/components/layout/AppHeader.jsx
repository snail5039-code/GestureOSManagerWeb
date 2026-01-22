import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthProvider";
import useLangMenu from "../../shared/useLangMenu";

import { useTheme } from "../theme/ThemeProvider";
import { THEME } from "../theme/themeTokens";

export default function AppHeader() {
  const { user, isAuthed, logout } = useAuth();
  const nav = useNavigate();

  const { t } = useTranslation(["header", "common"]);
  const { LANGUAGES, isLangOpen, setIsLangOpen, currentLang, selectLang } =
    useLangMenu();

  const onLogout = async () => {
    await logout();
    nav("/");
  };

  const { theme, toggleTheme } = useTheme();
  const T = THEME[theme];

  const NAV_ITEMS = [
    { to: "/", key: "home", label: t("header:nav.home", { defaultValue: "홈" }) },
    {
      to: "/about",
      key: "about",
      label: t("header:nav.about", { defaultValue: "소개" }),
    },
    {
      to: "/board",
      key: "board",
      label: t("header:nav.board", { defaultValue: "게시판" }),
    },
    {
      to: "/motionGuide",
      key: "motionGuide",
      label: t("header:nav.motionGuide", { defaultValue: "모션 가이드" }),
    },
    {
      to: "/download",
      key: "download",
      label: t("header:nav.download", { defaultValue: "다운로드" }),
    },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[var(--surface-soft)]/80 backdrop-blur-xl text-[color:var(--text-strong)]">
      {/* ✅ 헤더 높이도 살짝 키워서 로고가 답답하지 않게 */}
      <div className="flex h-[78px] items-center">
        {/* ✅ 좌측 브랜드 영역 (사이드바 폭과 맞추는 영역) */}
        <div className="hidden lg:flex w-84 h-full items-center px-6">
          <Link to="/" className="flex w-full items-center gap-4 select-none">
            {/* ✅ 로고 확실히 키움: 48 -> 60 */}
            <img
              src="/logo/logo.png"
              alt="GA"
              className="h-[120px] w-[120px] object-contain"
              draggable={false}
            />

            <div className="leading-tight min-w-0">
              {/* ✅ 타이틀도 살짝 키움 + 줄바꿈 방지 */}
              <div className="text-[22px] font-black text-[color:var(--text-strong)] tracking-tight whitespace-nowrap">
                {t("header:brand.title", { defaultValue: "Gesture OS Manager" })}
              </div>
            </div>
          </Link>
        </div>

        {/* ✅ 오른쪽 */}
        <div className="flex flex-1 items-center justify-between px-6 lg:px-10">
          {/* ✅ 모바일 좌측 로고/타이틀도 같이 키움 */}
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="lg:hidden flex items-center gap-3 text-[color:var(--text-strong)] hover:text-[color:var(--accent)] transition-colors select-none"
            >
              <img
                src="/logo/logo.png"
                alt="GA"
                className="h-12 w-12 object-contain"
                draggable={false}
              />
              <span className="text-[18px] font-black tracking-tight whitespace-nowrap text-[color:var(--text-strong)]">
                {t("header:brand.title", { defaultValue: "Gesture OS Manager" })}
              </span>
            </Link>

            <nav className="flex items-center gap-2 lg:hidden">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? "bg-[var(--surface)] text-[color:var(--text-strong)]"
                        : "text-[color:var(--muted)] hover:text-[color:var(--text-strong)] hover:bg-[rgba(59,130,246,0.12)]"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div>
              <button
                onClick={toggleTheme}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 ${T.border} ${T.panel} ${T.shadow2}`}
                title="테마 전환"
              >
                {/* ✅ 라이트에서도 글자 진하게 */}
                <span className="text-[color:var(--text-strong)]">
                  {theme === "dark" ? "Dark" : "Light"}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* 언어 드롭다운 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLangOpen((v) => !v)}
                className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2 text-xs text-[color:var(--text)] hover:text-[color:var(--text-strong)] transition-all"
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
                <span className="text-[color:var(--text-strong)]">{currentLang}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    isLangOpen ? "rotate-180" : ""
                  }`}
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
                      onClick={() => selectLang(lang.code)}
                      className="w-full rounded-xl px-3 py-2 text-left text-xs text-[color:var(--text)] hover:text-[color:var(--text-strong)] hover:bg-[rgba(59,130,246,0.15)] transition-all"
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-6 w-[1px] bg-[var(--border)] mx-2" />

            {!isAuthed ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 px-4 py-2 text-xs text-[color:var(--text)] hover:text-[color:var(--text-strong)] transition-all"
                >
                  {t("header:auth.login", { defaultValue: "로그인" })}
                </Link>
                <Link
                  to="/join"
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-black text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)] hover:bg-[var(--accent-strong)] transition-all"
                >
                  {t("header:auth.join", { defaultValue: "회원가입" })}
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/mypage"
                  className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-1.5 text-xs text-[color:var(--text)] hover:text-[color:var(--text-strong)] transition-all"
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
                  <span className="text-[color:var(--text-strong)]">
                    {user?.nickname || user?.name}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 px-4 py-2 text-xs text-[color:var(--text)] hover:text-[color:var(--text-strong)] transition-all"
                >
                  {t("header:auth.logout", { defaultValue: "로그아웃" })}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
