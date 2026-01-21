import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export default function Home() {
  // ✅ home.json을 namespace로 로드하는 방식이면 이게 제일 깔끔함
  // (예: i18n에서 resources에 home: homeJson 형태)
  const { t } = useTranslation("home");

  const statusItems = useMemo(
    () => [
      {
        key: "connection",
        label: t("liveStatus.card.connection"),
        value: t("liveStatus.value.stable"),
        tone: "text-[var(--success)]",
      },
      {
        key: "activeGesture",
        label: t("liveStatus.card.activeGesture"),
        value: t("liveStatus.value.none"),
        tone: "text-[var(--muted)]",
      },
      {
        key: "fps",
        label: t("liveStatus.card.fps"),
        value: "30.2",
        tone: "text-white",
      },
      {
        key: "mode",
        label: t("liveStatus.card.mode"),
        value: t("liveStatus.value.mouse"),
        tone: "text-white",
      },
    ],
    [t]
  );

  const actionKeys = ["start", "stop", "preview", "refresh"];

  const updates = t("recentUpdates.items", { returnObjects: true });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-[var(--muted)]">{t("systemOverview")}</div>
          <h1 className="text-3xl tracking-tight text-white">{t("title")}</h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
            {t("polling", { ms: 500 })}
          </span>
          <span className="rounded-full bg-[var(--accent)]/20 px-3 py-1 text-xs text-[var(--accent)]">
            {t("connected")}
          </span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_40px_rgba(6,12,26,0.45)]">
          <h2 className="text-lg text-white">{t("liveStatus.title")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("liveStatus.desc")}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {statusItems.map((item) => (
              <div
                key={item.key}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
              >
                <div className="text-xs text-[var(--muted)]">{item.label}</div>
                <div className={`mt-1 text-lg ${item.tone}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="text-sm text-white">{t("quickActions.title")}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {actionKeys.map((k) => (
                <button
                  key={k}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-xs text-[var(--muted)] hover:text-white transition-all"
                >
                  {t(`quickActions.${k}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="text-sm text-white">{t("recentUpdates.title")}</h3>

            <ul className="mt-3 space-y-3 text-xs text-[var(--muted)]">
              {(Array.isArray(updates) ? updates : []).map((text, idx) => (
                <li key={idx}>{text}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
