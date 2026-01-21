import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function MotionGuide() {
  const { t } = useTranslation("motionGuide");

  const modes = useMemo(
    () => [
      { key: "all", label: t("modes.all") },
      { key: "mouse", label: t("modes.mouse") },
      { key: "keyboard", label: t("modes.keyboard") },
      { key: "draw", label: t("modes.draw") },
      { key: "presentation", label: t("modes.presentation") }
    ],
    [t]
  );

  const gestures = t("gestures", { returnObjects: true });
  const cautionItems = t("caution.items", { returnObjects: true });

  const [activeMode, setActiveMode] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const list = Array.isArray(gestures) ? gestures : [];
    return list.filter((g) => {
      if (!g) return false;
      const modeOk = activeMode === "all" ? true : g.mode === activeMode;

      const hay = [
        g.name,
        g.summary,
        g.trigger,
        g.action,
        ...(Array.isArray(g.howTo) ? g.howTo : []),
        ...(Array.isArray(g.tips) ? g.tips : []),
        ...(Array.isArray(g.pitfalls) ? g.pitfalls : [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const qOk = normalizedQuery ? hay.includes(normalizedQuery) : true;
      return modeOk && qOk;
    });
  }, [gestures, activeMode, normalizedQuery]);

  const selected = useMemo(() => {
    const list = Array.isArray(gestures) ? gestures : [];
    return list.find((g) => g?.id === selectedId) || null;
  }, [gestures, selectedId]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-[var(--muted)]">{t("navTitle")}</div>
          <h1 className="text-2xl tracking-tight text-white">{t("title")}</h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
            {t("status.live")}
          </span>
          <span className="rounded-full bg-[var(--accent)]/20 px-3 py-1 text-xs text-[var(--accent)]">
            {t("status.ready")}
          </span>
        </div>
      </header>

      {/* mode tabs + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {modes.map((m) => {
            const active = activeMode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setActiveMode(m.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-all select-none",
                  active
                    ? "bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                    : "border border-[var(--border)] text-[var(--muted)] hover:text-white"
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="w-full sm:w-[340px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("list.searchPlaceholder")}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-white placeholder:text-[var(--muted)] outline-none focus:ring-2 focus:ring-[var(--accent)]/35"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        {/* left list */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_40px_rgba(6,12,26,0.45)]">
          <h2 className="text-lg text-white">{t("list.title")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("list.desc")}</p>

          <div className="mt-6 space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4 text-sm text-[var(--muted)]">
                {t("list.empty")}
              </div>
            ) : (
              filtered.map((item) => {
                const isActive = selectedId === item.id;
                const thumb = item?.media?.thumb;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "w-full text-left flex items-center justify-between gap-3 rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 transition-all",
                      isActive
                        ? "border-[var(--accent)]/60 ring-2 ring-[var(--accent)]/15"
                        : "border-[var(--border)] hover:border-[var(--accent)]/35"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* thumbnail slot */}
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={t("detail.imageAlt")}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-[10px] text-[var(--muted)]">IMG</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">
                          {item.name} <span className="text-[var(--muted)]">· {item.summary}</span>
                        </div>
                        <div className="text-xs text-[var(--muted)] truncate">
                          {item.trigger} → {item.action}
                        </div>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full bg-[var(--accent)]/15 px-3 py-1 text-[10px] text-[var(--accent)]">
                      {t("list.badge")}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* right detail + caution */}
        <aside className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="text-sm text-white">{t("detail.title")}</h3>

            {!selected ? (
              <p className="mt-3 text-xs text-[var(--muted)]">{t("detail.selectHint")}</p>
            ) : (
              <div className="mt-4 space-y-4">
                {/* big image slot */}
                <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]">
                  {selected?.media?.image ? (
                    <img
                      src={selected.media.image}
                      alt={t("detail.imageAlt")}
                      className="h-40 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-40 w-full flex items-center justify-center text-xs text-[var(--muted)]">
                      이미지 준비중 (나중에 여기 내가 만들어줄 거)
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-base text-white">
                    {selected.name} <span className="text-[var(--muted)]">· {selected.summary}</span>
                  </div>

                  <DetailRow label={t("detail.sections.summary")} value={selected.summary} />
                  <DetailRow label={t("detail.sections.trigger")} value={selected.trigger} />
                  <DetailRow label={t("detail.sections.action")} value={selected.action} />

                  <DetailList label={t("detail.sections.howTo")} items={selected.howTo} />
                  <DetailList label={t("detail.sections.tips")} items={selected.tips} />
                  <DetailList label={t("detail.sections.pitfalls")} items={selected.pitfalls} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="text-sm text-white">{t("caution.title")}</h3>
            <ul className="mt-3 space-y-2 text-xs text-[var(--muted)]">
              {(Array.isArray(cautionItems) ? cautionItems : []).map((text, idx) => (
                <li key={idx}>{text}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
      <div className="text-[10px] text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-xs text-white">{value}</div>
    </div>
  );
}

function DetailList({ label, items }) {
  const arr = Array.isArray(items) ? items.filter(Boolean) : [];
  if (arr.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
      <div className="text-[10px] text-[var(--muted)]">{label}</div>
      <ul className="mt-2 space-y-1 text-xs text-white/90">
        {arr.map((v, i) => (
          <li key={i}>• {v}</li>
        ))}
      </ul>
    </div>
  );
}
