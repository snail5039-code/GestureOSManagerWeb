import { useTranslation } from "react-i18next";

export default function About() {
  const { t } = useTranslation("about");

  const items = t("core.items", { returnObjects: true });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-[var(--muted)]">{t("navTitle")}</div>
          <h1 className="text-3xl tracking-tight text-white">{t("title")}</h1>
        </div>

        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
          {t("badge")}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
          <h2 className="text-lg text-white">{t("core.title")}</h2>

          <p className="mt-3 text-sm text-[var(--muted)]">{t("core.desc")}</p>

          <div className="mt-6 space-y-3 text-sm text-slate-200">
            {(Array.isArray(items) ? items : []).map((text, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
              >
                {text}
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
            <h3 className="text-sm text-white">{t("env.title")}</h3>
            <p className="mt-2 text-xs text-[var(--muted)]">{t("env.desc")}</p>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
            <h3 className="text-sm text-white">{t("status.title")}</h3>
            <p className="mt-2 text-xs text-[var(--muted)]">{t("status.desc")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
