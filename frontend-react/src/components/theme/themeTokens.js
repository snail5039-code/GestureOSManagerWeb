// src/components/theme/themeTokens.js
export const THEMES = ["dark", "light"];

export const THEME = {
  dark: {
    // 공통적으로 쓰기 좋은 “표준 클래스”
    pageText: "text-[color:var(--text)]",
    mutedText: "text-[color:var(--muted)]",
    panel: "bg-[color:var(--surface)] border border-[color:var(--border)]",
    panelSoft: "bg-[color:var(--surface-soft)] border border-[color:var(--border)]",
    chip: "bg-[color:var(--chip)] border border-[color:var(--border)]",
    input:
      "bg-[color:var(--input)] border border-[color:var(--border)] text-[color:var(--text)] placeholder:text-[color:var(--muted)]",
    ring: "ring-1 ring-[color:var(--border)]",
    btnPrimary: "bg-[color:var(--accent)] text-white hover:opacity-95",
    btnGhost:
      "bg-transparent border border-[color:var(--border)] text-[color:var(--text)] hover:bg-[color:var(--surface)]",
  },
  light: {
    pageText: "text-[color:var(--text)]",
    mutedText: "text-[color:var(--muted)]",
    panel: "bg-[color:var(--surface)] border border-[color:var(--border)]",
    panelSoft: "bg-[color:var(--surface-soft)] border border-[color:var(--border)]",
    chip: "bg-[color:var(--chip)] border border-[color:var(--border)]",
    input:
      "bg-[color:var(--input)] border border-[color:var(--border)] text-[color:var(--text)] placeholder:text-[color:var(--muted)]",
    ring: "ring-1 ring-[color:var(--border)]",
    btnPrimary: "bg-[color:var(--accent)] text-white hover:opacity-95",
    btnGhost:
      "bg-transparent border border-[color:var(--border)] text-[color:var(--text)] hover:bg-[color:var(--surface)]",
  },
};
