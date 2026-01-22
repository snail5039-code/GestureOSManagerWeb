// front/src/pages/download/MobileAppCard.jsx (경로는 네 Download.jsx 위치에 맞춰)
import { useTranslation } from "react-i18next";

export default function MobileAppCard() {
  const { t } = useTranslation("download");

  // public/downloads/app-release.apk 로 두면 그대로 동작
  const apkHref = t("mobileApp.apkHref", { defaultValue: "/downloads/app-release.apk" });
  const features = t("mobileApp.features", { returnObjects: true });

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg text-[color:var(--text)]">{t("mobileApp.title")}</h2>
          <p className="mt-3 text-sm text-[var(--muted)]">{t("mobileApp.desc")}</p>
        </div>

        <span className="shrink-0 rounded-full bg-[var(--accent)]/20 px-3 py-1 text-xs text-[var(--accent)]">
          {t("mobileApp.badge")}
        </span>
      </div>

      {Array.isArray(features) && features.length > 0 && (
        <ul className="mt-4 space-y-2 text-xs text-[var(--muted)]">
          {features.map((text, idx) => (
            <li key={idx}>• {text}</li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={apkHref}
          download
          className="inline-flex items-center justify-center rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm text-white hover:opacity-95 active:opacity-90"
        >
          {t("mobileApp.button")}
        </a>

        <span className="text-xs text-[var(--muted)]">{t("mobileApp.note")}</span>
      </div>
    </section>
  );
}
