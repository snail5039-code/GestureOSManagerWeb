import { useTranslation } from "react-i18next";

export default function SocialLoginButtons() {
  const { t } = useTranslation("member");

  const goToLogin = (provider) => {
    window.location.href = `/oauth2/authorization/${provider}`;
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
          <span className="text-[10px] text-[var(--muted)]">{t("social.continue")}</span>
        </button>
      ))}
    </div>
  );
}
