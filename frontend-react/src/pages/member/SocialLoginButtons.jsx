import { useTranslation } from "react-i18next";

function getAuthOrigin() {
  if (typeof window === "undefined") return "";

  const isFile = window.location.protocol === "file:";
  const rt = window.__RUNTIME_CONFIG__ || {};

  // file://일 때만 ORIGIN / AUTH_BASE 활용
  if (isFile) {
    if (rt.AUTH_ORIGIN) return String(rt.AUTH_ORIGIN).replace(/\/$/, "");
    if (rt.ORIGIN) return String(rt.ORIGIN).replace(/\/$/, "");
    // fallback: 로컬 auth
    return "http://127.0.0.1:8082";
  }

  // 웹 배포: 같은 오리진(nginx가 /oauth2/ 를 백엔드로 넘겨줘야 함)
  return window.location.origin;
}

export default function SocialLoginButtons() {
  const { t } = useTranslation("member");
  const AUTH_ORIGIN = getAuthOrigin();

  const goToLogin = (provider) => {
    const redirectUri = `${window.location.origin}/oauth2/success`;

    const url =
      `${AUTH_ORIGIN}/oauth2/authorization/${provider}` +
      `?redirect_uri=${encodeURIComponent(redirectUri)}`;

    window.location.href = url;
  };

  return (
    <div className="space-y-3">
      {["google", "kakao", "naver"].map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => goToLogin(p)}
          className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs text-[color:var(--text)] hover:border-[var(--accent)] transition-all"
        >
          <span>{t(`social.provider.${p}`)}</span>
          <span className="text-[10px] text-[var(--muted)]">
            {t("social.continue")}
          </span>
        </button>
      ))}
    </div>
  );
}
