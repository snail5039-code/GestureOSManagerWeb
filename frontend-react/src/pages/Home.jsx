import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import heroBanner from "../assets/hero-banner.png";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function useTF(ns) {
  const { t } = useTranslation(ns);
  const tf = (key, fallback, opt) => {
    const v = t(key, opt);
    if (!v || v === key) return fallback;
    return v;
  };
  return { t, tf };
}

function useInView(options = { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
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
        inView ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-3 blur-[2px]",
        className
      )}
    >
      {children}
    </div>
  );
}

function detectTheme() {
  const root = document.documentElement;

  const dt = root.getAttribute("data-theme");
  if (dt === "dark" || dt === "light") return dt;

  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";

  const ls =
    localStorage.getItem("theme") ||
    localStorage.getItem("THEME") ||
    localStorage.getItem("app_theme") ||
    localStorage.getItem("gestureos_theme");
  if (ls === "dark" || ls === "light") return ls;

  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function Icon({ name, className = "" }) {
  const cls = cn("h-5 w-5 text-[var(--accent)]", className);

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

  if (name === "settings")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.4 15a7.8 7.8 0 0 0 .1-1 7.8 7.8 0 0 0-.1-1l2-1.6-2-3.4-2.5 1a8.3 8.3 0 0 0-1.7-1l-.4-2.7H10l-.4 2.7a8.3 8.3 0 0 0-1.7 1l-2.5-1-2 3.4 2 1.6a7.8 7.8 0 0 0-.1 1 7.8 7.8 0 0 0 .1 1l-2 1.6 2 3.4 2.5-1c.5.4 1.1.7 1.7 1l.4 2.7h4.6l.4-2.7c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.4-2-1.6z"
        />
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

  if (name === "download")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 10.5L12 14l3.5-3.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 20h14" />
      </svg>
    );

  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
    </svg>
  );
}

function ChipLink({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[var(--border)] bg-[rgba(6,12,26,0.22)] px-3 py-1 text-xs text-[color:var(--text)]/85 hover:border-[var(--accent)]/45 transition-colors"
    >
      {children}
    </button>
  );
}

function SectionTitle({ eyebrow, title, desc, right }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs text-[var(--muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            {eyebrow}
          </div>
        )}
        <h3 className="mt-3 text-xl sm:text-2xl font-extrabold tracking-tight text-[color:var(--text)]">{title}</h3>
        {desc && <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] max-w-3xl">{desc}</p>}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-5 flex items-start justify-between gap-4"
      >
        <div className="text-sm font-extrabold text-[color:var(--text)]">{q}</div>
        <div className={cn("mt-0.5 text-xs text-[var(--muted)] transition-transform", open ? "rotate-180" : "")}>
          ▼
        </div>
      </button>
      <div className={cn("grid transition-all", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden px-5 pb-5 text-sm leading-relaxed text-[var(--muted)]">{a}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const { tf } = useTF("home");
  const nav = useNavigate();

  // ✅ 실제 라우트
  const goMotionGuide = () => nav("/motionGuide");
  const goDownload = () => nav("/download");
  const goQna = () => nav("/board?type=qna");
  const goUpdates = () => nav("/board?type=notice");

  const slides = useMemo(
    () => [
      {
        k: "s1",
        eyebrow: tf("hero.slides.0.eyebrow", "Manager UI"),
        title: tf("hero.slides.0.title", "설정과 안내를 홈에서 한눈에"),
        desc: tf("hero.slides.0.desc", "다운로드 · 모션 가이드 · QnA로 바로 이동")
      },
      {
        k: "s2",
        eyebrow: tf("hero.slides.1.eyebrow", "Support"),
        title: tf("hero.slides.1.title", "막히는 순간, 카드로 해결"),
        desc: tf("hero.slides.1.desc", "자주 나오는 이슈를 빠르게 확인")
      },
      {
        k: "s3",
        eyebrow: tf("hero.slides.2.eyebrow", "Motion Guide"),
        title: tf("hero.slides.2.title", "동작을 검색하고 바로 따라하기"),
        desc: tf("hero.slides.2.desc", "모션 가이드에서 설명과 예시 확인")
      }
    ],
    [tf]
  );

  const [slideIdx, setSlideIdx] = useState(0);
  const cur = slides[slideIdx];

  const [heroVars, setHeroVars] = useState(() => {
    const th = typeof window !== "undefined" ? detectTheme() : "dark";
    return th === "dark"
      ? {
          "--hero-img-opacity": 0.34,
          "--hero-img-scale": 1.02,
          "--hero-img-filter": "saturate(1.10) contrast(1.08)",
          "--hero-scrim-0": "rgba(7, 12, 24, 0.56)",
          "--hero-scrim-1": "rgba(7, 12, 24, 0.18)",
          "--hero-scrim-2": "rgba(7, 12, 24, 0.06)",
          "--hero-object-pos": "72% 50%"
        }
      : {
          "--hero-img-opacity": 0.22,
          "--hero-img-scale": 1.01,
          "--hero-img-filter": "saturate(1.05) contrast(1.05)",
          "--hero-scrim-0": "rgba(255, 255, 255, 0.72)",
          "--hero-scrim-1": "rgba(255, 255, 255, 0.18)",
          "--hero-scrim-2": "rgba(255, 255, 255, 0.06)",
          "--hero-object-pos": "78% 50%"
        };
  });

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
              "--hero-scrim-0": "rgba(7, 12, 24, 0.56)",
              "--hero-scrim-1": "rgba(7, 12, 24, 0.18)",
              "--hero-scrim-2": "rgba(7, 12, 24, 0.06)",
              "--hero-object-pos": "72% 50%"
            }
          : {
              "--hero-img-opacity": 0.22,
              "--hero-img-scale": 1.01,
              "--hero-img-filter": "saturate(1.05) contrast(1.05)",
              "--hero-scrim-0": "rgba(255, 255, 255, 0.72)",
              "--hero-scrim-1": "rgba(255, 255, 255, 0.18)",
              "--hero-scrim-2": "rgba(255, 255, 255, 0.06)",
              "--hero-object-pos": "78% 50%"
            }
      );
    };

    apply();
    const mo = new MutationObserver(() => apply());
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onMq = () => apply();
    mq?.addEventListener?.("change", onMq);

    return () => {
      mo.disconnect();
      mq?.removeEventListener?.("change", onMq);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setSlideIdx((v) => (v + 1) % slides.length), 5200);
    return () => window.clearInterval(id);
  }, [slides.length]);

  // ✅ 메뉴 카드
  const overview = useMemo(
    () => [
      { icon: "guide", title: tf("overview.items.0.title", "모션 가이드"), desc: tf("overview.items.0.desc", "동작을 검색하고 사용법을 확인") },
      { icon: "settings", title: tf("overview.items.1.title", "제스처 설정"), desc: tf("overview.items.1.desc", "모드별 동작을 기능으로 연결") },
      { icon: "board", title: tf("overview.items.2.title", "게시판"), desc: tf("overview.items.2.desc", "공지와 공유 글 확인") },
      { icon: "board", title: tf("overview.items.3.title", "QnA"), desc: tf("overview.items.3.desc", "자주 묻는 질문 확인") }
    ],
    [tf]
  );

  // ✅ 사용 흐름
  const steps = useMemo(
    () => [
      { n: "01", t: tf("how.steps.0.title", "연결"), d: tf("how.steps.0.desc", "카메라/기기 연결 확인") },
      { n: "02", t: tf("how.steps.1.title", "보정"), d: tf("how.steps.1.desc", "환경에 맞춰 감도 조정") },
      { n: "03", t: tf("how.steps.2.title", "학습"), d: tf("how.steps.2.desc", "모션 가이드로 동작 익히기") },
      { n: "04", t: tf("how.steps.3.title", "설정"), d: tf("how.steps.3.desc", "제스처를 기능으로 연결") }
    ],
    [tf]
  );

  // ✅ FAQ
  const faqs = useMemo(
    () => [
      { q: tf("faq.q0", "카메라가 없거나 인식이 안 되면?"), a: tf("faq.a0", "연결/권한 확인 후 조명과 배경부터 정리") },
      { q: tf("faq.q1", "제스처가 가끔 오동작해요"), a: tf("faq.a1", "거리/조명 영향 큼 · 보정값 저장 추천") },
      { q: tf("faq.q2", "모션 가이드는 어디서 보나요?"), a: tf("faq.a2", "모션 가이드 메뉴에서 검색") }
    ],
    [tf]
  );

  return (
    <div className="space-y-8">
      {/* 배경(웹페이지 느낌) */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(circle_at_88%_22%,rgba(124,58,237,0.14),transparent_60%),radial-gradient(circle_at_55%_90%,rgba(16,185,129,0.10),transparent_62%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:48px_48px]" />

      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-[var(--muted)]">{tf("systemOverview", "시스템 개요")}</div>
          <h1 className="text-3xl tracking-tight text-[color:var(--text)]">{tf("title", "Gesture OS Manager")}</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--text)] hover:border-[var(--accent)]/45 transition-colors"
            onClick={goDownload}
          >
            {tf("topCta.secondary", "다운로드")}
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] transition-colors"
            onClick={goMotionGuide}
          >
            {tf("topCta.primary", "모션 가이드")}
          </button>
        </div>
      </header>

      {/* HERO */}
      <Reveal>
        <section
          className="relative overflow-hidden rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)]"
          style={heroVars}
        >
          <img
            src={heroBanner}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: "var(--hero-img-opacity)",
              filter: "var(--hero-img-filter)",
              transform: "scale(var(--hero-img-scale))",
              objectPosition: "var(--hero-object-pos)"
            }}
            draggable={false}
          />

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "linear-gradient(90deg,var(--hero-scrim-0),var(--hero-scrim-1),var(--hero-scrim-2))"
            }}
          />

          <div className="relative p-7 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs text-[var(--muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  {cur.eyebrow}
                </div>

                <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-[color:var(--text)]">
                  {cur.title}
                </h2>

                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{cur.desc}</p>

                {/* ✅ 상단 칩: 번역 변수 적용(기능/디자인 그대로) */}
                <div className="mt-5 flex flex-wrap gap-2">
                  <ChipLink onClick={goMotionGuide}>{tf("hero.pills.0", "Motion Guide")}</ChipLink>
                  <ChipLink onClick={goDownload}>{tf("hero.pills.1", "다운로드")}</ChipLink>
                  <ChipLink onClick={goQna}>{tf("hero.pills.2", "QnA")}</ChipLink>
                  <ChipLink onClick={goUpdates}>{tf("hero.pills.3", "Updates")}</ChipLink>
                </div>

                {/* CTA 버튼 */}
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] transition-colors"
                    onClick={goDownload}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon name="download" className="h-4 w-4 text-white" />
                      {tf("hero.cta.primary", "매니저 다운로드")}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold text-[color:var(--text)] hover:border-[var(--accent)]/45 transition-colors"
                    onClick={goMotionGuide}
                  >
                    {tf("hero.cta.secondary", "모션 가이드 둘러보기")}
                  </button>
                </div>

                <div className="mt-4 text-xs text-[var(--muted)]">{tf("hero.hint", "스크롤해서 더 둘러보세요.")}</div>
              </div>

              {/* 슬라이드 컨트롤 */}
              <div className="flex items-center gap-2 self-start">
                <button
                  type="button"
                  onClick={() => setSlideIdx((v) => (v - 1 + slides.length) % slides.length)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--text)] hover:border-[var(--accent)]/45 transition-colors"
                >
                  {tf("hero.controls.prev", "이전")}
                </button>
                <button
                  type="button"
                  onClick={() => setSlideIdx((v) => (v + 1) % slides.length)}
                  className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] transition-colors"
                >
                  {tf("hero.controls.next", "다음")}
                </button>
              </div>
            </div>

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
                  aria-label={tf("hero.controls.go", `슬라이드 ${i + 1}`, { n: i + 1 })}
                  title={tf("hero.controls.go", `슬라이드 ${i + 1}`, { n: i + 1 })}
                />
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* 핵심 메뉴 */}
      <Reveal>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
          <SectionTitle
            eyebrow={tf("overview.eyebrow", "Overview")}
            title={tf("overview.title", "핵심 메뉴")}
            desc={tf("overview.desc", "자주 쓰는 메뉴로 빠르게 이동")}
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {overview.map((c) => (
              <div key={c.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/12 ring-1 ring-[var(--accent)]/18">
                  <Icon name={c.icon} />
                </div>
                <div className="text-sm font-extrabold text-[color:var(--text)]">{c.title}</div>
                <div className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{c.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* 사용 흐름 + FAQ */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <section className="space-y-6">
          <Reveal>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
              <SectionTitle
                eyebrow={tf("how.eyebrow", "Flow")}
                title={tf("how.title", "사용 흐름")}
                desc={tf("how.desc", "연결 → 보정 → 학습 → 설정")}
              />

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {steps.map((s) => (
                  <div key={s.n} className="rounded-2xl border border-[var(--border)] bg-[rgba(6,12,26,0.18)] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-[var(--muted)]">{s.n}</div>
                      <div className="h-px flex-1 bg-[var(--border)]/70" />
                    </div>
                    <div className="mt-3 text-sm font-extrabold text-[color:var(--text)]">{s.t}</div>
                    <div className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{s.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* 다운로드 */}
          <Reveal>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
              <SectionTitle
                eyebrow={tf("download.eyebrow", "Download")}
                title={tf("download.title", "다운로드")}
                desc={tf("download.desc", "설치 파일과 사용 안내")}
                right={
                  <button
                    type="button"
                    className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] transition-colors"
                    onClick={goDownload}
                  >
                    {tf("download.cta", "다운로드 페이지로 이동")}
                  </button>
                }
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[rgba(6,12,26,0.18)] px-3 py-1 text-xs text-[color:var(--text)]/85">
                  {tf("download.p0", "설치 파일")}
                </span>
                <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[rgba(6,12,26,0.18)] px-3 py-1 text-xs text-[color:var(--text)]/85">
                  {tf("download.p1", "최신 버전")}
                </span>
                <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[rgba(6,12,26,0.18)] px-3 py-1 text-xs text-[color:var(--text)]/85">
                  {tf("download.p2", "업데이트 안내")}
                </span>
              </div>
            </div>
          </Reveal>
        </section>

        <aside className="space-y-6">
          <Reveal>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
              <SectionTitle
                eyebrow={tf("faq.eyebrow", "QnA")}
                title={tf("faq.title", "자주 묻는 질문")}
                desc={tf("faq.desc", "필수만 짧게")}
              />

              <div className="mt-4 space-y-3">
                {faqs.map((f) => (
                  <FAQItem key={f.q} q={f.q} a={f.a} />
                ))}
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] transition-colors"
                  onClick={goQna}
                >
                  {tf("faq.cta", "QnA로 이동")}
                </button>
              </div>
            </div>
          </Reveal>
        </aside>
      </div>

      <div className="pt-2 text-center text-xs text-[var(--muted)]">{tf("footer", "© Gesture OS Manager")}</div>
    </div>
  );
}
