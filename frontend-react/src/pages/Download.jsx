import { useTranslation } from "react-i18next";
import MobileAppCard from "./MobileAppCard"; // ✅ 추가

export default function Download() {
  const { t } = useTranslation("download");

  const reqs = t("requirements.items", { returnObjects: true });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-[var(--muted)]">{t("navTitle")}</div>
          <h1 className="text-3xl tracking-tight text-[color:var(--text)]">{t("title")}</h1>
        </div>

        <span className="rounded-full bg-[var(--accent)]/20 px-3 py-1 text-xs text-[var(--accent)]">
          {t("badge")}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        {/* ✅ 기존 데스크톱 섹션 그대로 + 아래에 모바일 카드만 추가 */}
        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
            <h2 className="text-lg text-[color:var(--text)]">{t("desktopApp.title")}</h2>

            <p className="mt-3 text-sm text-[var(--muted)]">{t("desktopApp.desc")}</p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled
                className="rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm text-white opacity-60"
              >
                {t("desktopApp.button")}
              </button>

              <span className="text-xs text-[var(--muted)]">{t("desktopApp.note")}</span>
            </div>
          </section>

          <MobileAppCard />
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
            <h3 className="text-sm text-[color:var(--text)]">{t("requirements.title")}</h3>

            <ul className="mt-3 space-y-2 text-xs text-[var(--muted)]">
              {(Array.isArray(reqs) ? reqs : []).map((text, idx) => (
                <li key={idx}>{text}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
            <h3 className="text-sm text-[color:var(--text)]">{t("version.title")}</h3>
            <p className="mt-2 text-xs text-[var(--muted)]">{t("version.value")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
