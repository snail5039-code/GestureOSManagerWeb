import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// ✅ 배너 이미지 추가 (경로 맞춰)
import heroBanner from "../assets/hero-banner.png";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

/** 스크롤 리빌(IntersectionObserver) - 기능 영향 없이 "보이는 순간"만 스타일 변경 */
function useInView(options = { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect(); // 한번만 등장
      }
    }, options);

    io.observe(el);
    return () => io.disconnect();
  }, [options]);

  return { ref, inView };
}

function Reveal({ children, className = "" }) {
  const { ref, inView } = useInView();

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out will-change-transform",
        inView ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-[2px]",
        className
      )}
    >
      {children}
    </div>
  );
}

function detectTheme() {
  const root = document.documentElement;

  // 1) data-theme 우선
  const dt = root.getAttribute("data-theme");
  if (dt === "dark" || dt === "light") return dt;

  // 2) class 기반일 수도 있음
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";

  // 3) localStorage 흔한 키들 체크
  const ls =
    localStorage.getItem("theme") ||
    localStorage.getItem("THEME") ||
    localStorage.getItem("app_theme") ||
    localStorage.getItem("gestureos_theme");
  if (ls === "dark" || ls === "light") return ls;

  // 4) 마지막 fallback: OS 설정
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function Home() {
  const { t } = useTranslation("home");

  const updates = t("recentUpdates.items", { returnObjects: true });

  // ✅ 홈에서 보여줄 “진짜 필요한” 메시지/섹션만
  const featureCards = useMemo(
    () => [
      { icon: "guide", title: t("features.items.0.title"), desc: t("features.items.0.desc") },
      { icon: "mapping", title: t("features.items.1.title"), desc: t("features.items.1.desc") },
      { icon: "board", title: t("features.items.2.title"), desc: t("features.items.2.desc") },
      { icon: "support", title: t("features.items.3.title"), desc: t("features.items.3.desc") },
    ],
    [t]
  );

  // ✅ Hero 슬라이드(텍스트만) - 홈 첫인상용
  const slides = useMemo(
    () => [
      {
        k: "s1",
        eyebrow: t("hero.slides.0.eyebrow"),
        title: t("hero.slides.0.title"),
        desc: t("hero.slides.0.desc"),
      },
      {
        k: "s2",
        eyebrow: t("hero.slides.1.eyebrow"),
        title: t("hero.slides.1.title"),
        desc: t("hero.slides.1.desc"),
      },
      {
        k: "s3",
        eyebrow: t("hero.slides.2.eyebrow"),
        title: t("hero.slides.2.title"),
        desc: t("hero.slides.2.desc"),
      },
    ],
    [t]
  );

  const [slideIdx, setSlideIdx] = useState(0);

  // ✅ HERO용 테마 튜닝 값 (전역 토큰 건드리지 않고 "여기서만" 제어)
  const [heroVars, setHeroVars] = useState(() => {
    const th = typeof window !== "undefined" ? detectTheme() : "dark";
    return th === "dark"
      ? {
          "--hero-img-opacity": 0.34, // 다크에서 이미지 더 보이게
          "--hero-img-scale": 1.02,   // 과한 확대 줄여서 "잘림" 완화
          "--hero-img-filter": "saturate(1.10) contrast(1.08)",
          // 왼쪽 가독성 확보(너무 새까맣지 않게)
          "--hero-scrim-0": "rgba(7, 12, 24, 0.46)",
          "--hero-scrim-1": "rgba(7, 12, 24, 0.18)",
          "--hero-scrim-2": "rgba(7, 12, 24, 0.06)",
          // 오른쪽에 손이 있으니까 조금 더 오른쪽을 보여주기
          "--hero-object-pos": "72% 50%",
        }
      : {
          "--hero-img-opacity": 0.22,
          "--hero-img-scale": 1.01,
          "--hero-img-filter": "saturate(1.05) contrast(1.05)",
          "--hero-scrim-0": "rgba(255, 255, 255, 0.64)",
          "--hero-scrim-1": "rgba(255, 255, 255, 0.18)",
          "--hero-scrim-2": "rgba(255, 255, 255, 0.06)",
          "--hero-object-pos": "78% 50%",
        };
  });

  // 테마 변경 감지 (data-theme / class 변경될 때 자동 반영)
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const th = detectTheme();
      setHeroVars(
        th === "dark"
          ? {
              "--hero-img-opacity": 0.34,
              "--hero-img-scale": 1.02,
              "--hero-img-filter": "saturate(1.10) contrast(1.08)",
              "--hero-scrim-0": "rgba(7, 12, 24, 0.46)",
              "--hero-scrim-1": "rgba(7, 12, 24, 0.18)",
              "--hero-scrim-2": "rgba(7, 12, 24, 0.06)",
              "--hero-object-pos": "72% 50%",
            }
          : {
              "--hero-img-opacity": 0.22,
              "--hero-img-scale": 1.01,
              "--hero-img-filter": "saturate(1.05) contrast(1.05)",
              "--hero-scrim-0": "rgba(255, 255, 255, 0.64)",
              "--hero-scrim-1": "rgba(255, 255, 255, 0.18)",
              "--hero-scrim-2": "rgba(255, 255, 255, 0.06)",
              "--hero-object-pos": "78% 50%",
            }
      );
    };

    apply();

    const mo = new MutationObserver(() => apply());
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });

    // OS 다크모드 변경도 반영(원하면)
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onMq = () => apply();
    mq?.addEventListener?.("change", onMq);

    return () => {
      mo.disconnect();
      mq?.removeEventListener?.("change", onMq);
    };
  }, []);

  // 자동 슬라이드 (홈 UI만, 기능 로직X)
  useEffect(() => {
    const id = window.setInterval(() => {
      setSlideIdx((v) => (v + 1) % slides.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const cur = slides[slideIdx];

  // 아이콘(가벼운 inline SVG)
  const Icon = ({ name }) => {
    const cls = "h-5 w-5 text-[var(--accent)]";
    if (name === "guide")
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6.5C4 5.12 5.12 4 6.5 4H20v15.5A2.5 2.5 0 0 1 17.5 22H6.5A2.5 2.5 0 0 1 4 19.5V6.5z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 11h8M8 15h6" />
        </svg>
      );
    if (name === "mapping")
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 17h10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 7l-3 4 3 4M14 17l3-4-3-4" />
        </svg>
      );
    if (name === "board")
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M8 12h8M8 15h5" />
        </svg>
      );
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 10.5l1.8 1.8 3.7-3.7" />
      </svg>
    );
  };

  return (
    <div className="space-y-8">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-[var(--muted)]">{t("systemOverview")}</div>
          {/* ✅ text-white -> var(--text) */}
          <h1 className="text-3xl tracking-tight text-[color:var(--text)]">{t("title")}</h1>
        </div>
      </header>

      {/* HERO (슬라이드) */}
      <Reveal>
        <section
          className="relative overflow-hidden rounded-[2.25rem] border border-[var(--border)] bg-[var(--surface)]"
          style={heroVars} // ✅ 전역 토큰 건드리지 않고 HERO 내부에서만 제어
        >
          {/* ✅ 배너 이미지 */}
          <img
            src={heroBanner}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: "var(--hero-img-opacity)",
              filter: "var(--hero-img-filter)",
              transform: "scale(var(--hero-img-scale))",
              objectPosition: "var(--hero-object-pos)",
            }}
            draggable={false}
          />

          {/* ✅ 가독성 스크림 */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg,var(--hero-scrim-0),var(--hero-scrim-1),var(--hero-scrim-2))",
            }}
          />

          {/* glow bg (기존 유지) */}
          <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_25%_20%,rgba(59,130,246,0.22),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(124,58,237,0.16),transparent_60%),radial-gradient(circle_at_55%_85%,rgba(16,185,129,0.10),transparent_62%)]" />

          <div className="relative p-7 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-6">
              {/* left text */}
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs text-[var(--muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  {cur.eyebrow}
                </div>

                {/* ✅ text-white -> var(--text) */}
                <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-[color:var(--text)]">
                  {cur.title}
                </h2>

                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{cur.desc}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {[t("hero.pills.0"), t("hero.pills.1"), t("hero.pills.2"), t("hero.pills.3")].map((x, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-[var(--border)] bg-[rgba(6,12,26,0.20)] px-3 py-1 text-xs text-[color:var(--text)]/85"
                    >
                      {x}
                    </span>
                  ))}
                </div>
              </div>

              {/* right controls */}
              <div className="flex items-center gap-2 self-start">
                <button
                  type="button"
                  onClick={() => setSlideIdx((v) => (v - 1 + slides.length) % slides.length)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--text)] hover:border-[var(--accent)]/45 transition-colors"
                >
                  {t("hero.controls.prev")}
                </button>
                <button
                  type="button"
                  onClick={() => setSlideIdx((v) => (v + 1) % slides.length)}
                  className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] transition-colors"
                >
                  {t("hero.controls.next")}
                </button>
              </div>
            </div>

            {/* dots */}
            <div className="mt-6 flex items-center gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.k}
                  type="button"
                  onClick={() => setSlideIdx(i)}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border transition-all",
                    i === slideIdx
                      ? "bg-[var(--accent)] border-[var(--accent)]"
                      : "bg-transparent border-[var(--border)] hover:border-[var(--accent)]/60"
                  )}
                  aria-label={t("hero.controls.go", { n: i + 1 })}
                  title={t("hero.controls.go", { n: i + 1 })}
                />
              ))}
              <div className="ml-2 text-xs text-[var(--muted)]">{t("hero.hint")}</div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* FEATURES */}
      <Reveal>
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
          <div className="flex items-end justify-between gap-3">
            {/* ✅ text-white -> var(--text) */}
            <h3 className="text-sm font-semibold text-[color:var(--text)]">{t("features.title")}</h3>
            <div className="text-xs text-[var(--muted)]">{t("features.badge")}</div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-5 transition-transform duration-300 hover:-translate-y-0.5"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/12 ring-1 ring-[var(--accent)]/18">
                  <Icon name={f.icon} />
                </div>

                {/* ✅ text-white -> var(--text) */}
                <div className="text-sm font-extrabold text-[color:var(--text)]">{f.title}</div>
                <div className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* SCROLL HIGHLIGHTS (스크롤 내리면 자연스럽게 등장하는 블록들) */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <section className="space-y-6">
          <Reveal>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
              {/* ✅ text-white -> var(--text) */}
              <h3 className="text-sm font-semibold text-[color:var(--text)]">{t("highlights.title")}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{t("highlights.desc")}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { t: t("highlights.items.0.title"), d: t("highlights.items.0.desc") },
                  { t: t("highlights.items.1.title"), d: t("highlights.items.1.desc") },
                  { t: t("highlights.items.2.title"), d: t("highlights.items.2.desc") },
                  { t: t("highlights.items.3.title"), d: t("highlights.items.3.desc") },
                ].map((x, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-[var(--border)] bg-[rgba(6,12,26,0.18)] p-5"
                  >
                    {/* ✅ text-white -> var(--text) */}
                    <div className="text-sm font-extrabold text-[color:var(--text)]">{x.t}</div>
                    <div className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{x.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
              {/* ✅ text-white -> var(--text) */}
              <h3 className="text-sm font-semibold text-[color:var(--text)]">{t("cta.title")}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{t("cta.desc")}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[t("cta.chips.0"), t("cta.chips.1"), t("cta.chips.2"), t("cta.chips.3")].map((x, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs text-[color:var(--text)]/85"
                  >
                    {x}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* RECENT UPDATES (기존 유지) */}
        <aside className="space-y-6">
          <Reveal>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
              <div className="flex items-end justify-between gap-3">
                {/* ✅ text-white -> var(--text) */}
                <h3 className="text-sm font-semibold text-[color:var(--text)]">{t("recentUpdates.title")}</h3>
                <div className="text-xs text-[var(--muted)]">{t("recentUpdates.badge")}</div>
              </div>

              <ul className="mt-4 space-y-3 text-xs text-[var(--muted)]">
                {(Array.isArray(updates) ? updates : []).map((text, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)]/70" />
                    <span className="leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
              {/* ✅ text-white -> var(--text) */}
              <h3 className="text-sm font-semibold text-[color:var(--text)]">{t("note.title")}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{t("note.desc")}</p>

              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-5 text-xs text-[var(--muted)]">
                {t("note.box")}
              </div>
            </div>
          </Reveal>
        </aside>
      </div>

      <p className="pt-2 text-center text-xs text-[var(--muted)]">{t("footer")}</p>
    </div>
  );
}
