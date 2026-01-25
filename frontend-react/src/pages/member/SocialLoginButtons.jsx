import { useTranslation } from "react-i18next";

const API_ORIGIN =
  import.meta.env?.VITE_API_ORIGIN ||
  import.meta.env?.VITE_API_URL ||
  "http://localhost:8082"; // ✅ 백엔드(웹) 8082

export default function SocialLoginButtons() {
  const { t } = useTranslation("member");

  const goToLogin = (provider) => {
    // ✅ 로그인 완료 후 돌아올 프론트(웹) 주소 5174
    const redirectUri = `${window.location.origin}/oauth2/redirect`; // 라우트명 너가 쓰는 걸로 통일

    // ✅ OAuth2 시작은 무조건 백엔드로 (프론트 상대경로 X)
    const url =
      `${API_ORIGIN}/oauth2/authorization/${provider}` +
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
