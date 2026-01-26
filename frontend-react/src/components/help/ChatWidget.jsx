// src/components/ChatWidget.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "./ChatWidget.css";
import { useTranslation } from "react-i18next";

const CHIPS_MIN_HEIGHT = 56;
const CHIPS_MAX_HEIGHT = 260;
const CHIPS_DEFAULT_HEIGHT = 140;

export default function ChatWidget() {
  const { t, i18n, ready } = useTranslation("chat");

  // ✅ 처음 로드시 닫힌 상태로 시작
  const [open, setOpen] = useState(false);

  const [isChipsCollapsed, setIsChipsCollapsed] = useState(false);
  const [chipsHeight, setChipsHeight] = useState(CHIPS_DEFAULT_HEIGHT);
  const dragState = useRef({
    startY: 0,
    startHeight: CHIPS_DEFAULT_HEIGHT,
    dragging: false,
  });

  const dockDragRef = useRef({ startY: 0, startTop: 140, dragging: false });
  const [dockTop, setDockTop] = useState(140);

  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("camera");

  const [input, setInput] = useState("");
  const [cards, setCards] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);

  const lang = i18n.language || "ko";

  // ✅ i18n 준비되면 첫 메시지 1번만 넣기
  useEffect(() => {
    if (!ready) return;
    setMessages([{ role: "assistant", type: "text", text: t("hello") }]);
  }, [ready, t]);

  // ✅ (중요) 언어 바뀌면 "챗 리셋"해서 첫 인사도 해당 언어로 다시 시작
  useEffect(() => {
    if (!ready) return;
    setSelectedCard(null);
    setInput("");
    setMessages([{ role: "assistant", type: "text", text: t("hello") }]);
  }, [lang, ready, t]);

  // ✅ Chips 영역 드래그 리사이즈
  useEffect(() => {
    const handleMove = (event) => {
      if (!dragState.current.dragging) return;
      const delta = event.clientY - dragState.current.startY;
      const next = Math.max(
        CHIPS_MIN_HEIGHT,
        Math.min(CHIPS_MAX_HEIGHT, dragState.current.startHeight + delta)
      );
      setChipsHeight(next);
    };

    const handleUp = () => {
      if (!dragState.current.dragging) return;
      dragState.current.dragging = false;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  // ✅ Dock 드래그
  useEffect(() => {
    const handleMove = (event) => {
      if (!dockDragRef.current.dragging) return;
      const delta = event.clientY - dockDragRef.current.startY;
      const next = dockDragRef.current.startTop + delta;
      const min = 80;
      const max = Math.max(min, window.innerHeight - 120);
      setDockTop(Math.min(max, Math.max(min, next)));
    };

    const handleUp = () => {
      dockDragRef.current.dragging = false;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const handleChipsResizeStart = (event) => {
    dragState.current.dragging = true;
    dragState.current.startY = event.clientY;
    dragState.current.startHeight = chipsHeight;
  };

  const handleDockDragStart = (event) => {
    dockDragRef.current.dragging = true;
    dockDragRef.current.startY = event.clientY;
    dockDragRef.current.startTop = dockTop;
  };

  // ✅ categories 로드
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await axios.get("/api/help/categories");
        if (!alive) return;

        const arr = (res.data || []).map((key) => ({ key, label: key }));
        setCategories(arr);

        if (arr.length && !arr.find((c) => c.key === category)) {
          setCategory(arr[0].key);
        }
      } catch {
        if (!alive) return;
        setCategories([
          { key: "camera", label: "camera" },
          { key: "error", label: "error" },
          { key: "call", label: "call" },
        ]);
      }
    })();

    return () => (alive = false);
  }, [category]);

  // ✅ cards 로드 (서버에서 lang별 카드 내려받기)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(
          `/api/help/cards?category=${encodeURIComponent(category)}&lang=${encodeURIComponent(lang)}`
        );
        if (!alive) return;
        setCards(res.data || []);
        console.log("[ChatWidget] category =", category, "lang =", lang);
      } catch {
        if (!alive) return;
        setCards([]);
      }
    })();
    return () => (alive = false);
  }, [category, lang]);

  const quickChips = useMemo(() => {
    const arr = [];
    for (const c of cards) {
      if (c?.symptoms?.length) arr.push(...c.symptoms);
      if (c?.title) arr.push(c.title);
      if (arr.length >= 10) break;
    }
    return [...new Set(arr)].slice(0, 8);
  }, [cards]);

  // ✅ history 생성 (최근 8개 정도만)
  const buildHistory = (msgs) =>
    (msgs || [])
      .filter((m) => m?.type === "text" && (m.role === "user" || m.role === "assistant"))
      .slice(-8)
      .map((m) => ({ role: m.role, text: String(m.text || "") }));

  const send = async (text) => {
    const msg = (text || "").trim();
    if (!msg) return;

    setMessages((m) => [...m, { role: "user", type: "text", text: msg }]);
    setInput("");

    // NOTE: state 업데이트 타이밍 때문에, history는 "보내기 직전까지의 메시지" 기준으로 만들기
    const prevHistory = buildHistory(messages);

    try {
      const res = await axios.post("/api/help/chat", {
        message: msg,
        context: { category, lang },
        history: prevHistory,
      });

      const data = res.data || {};
      const matched = data.matched || [];

      setMessages((m) => [
        ...m,
        { role: "assistant", type: "text", text: data.text || t("fallback") },
        { role: "assistant", type: "cards", matched },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", type: "text", text: t("fail") }]);
    }
  };

  const openCard = async (id) => {
    try {
      const res = await axios.get(
        `/api/help/cards/${encodeURIComponent(id)}?lang=${encodeURIComponent(lang)}`
      );
      setSelectedCard(res.data);
    } catch {
      setSelectedCard(null);
    }
  };

  if (!open) {
    return (
      <button
        className="cw-dock"
        style={{ top: dockTop }}
        onMouseDown={handleDockDragStart}
        onClick={() => setOpen(true)}
        type="button"
      >
        {t("dock")}
      </button>
    );
  }

  return (
    <div className={`cw-panel ${isChipsCollapsed ? "is-chips-collapsed" : ""}`} aria-hidden={!open}>
      <div className="cw-shell">
        <div className="cw-header">
          <div className="cw-header-row">
            <div className="cw-title">{t("title")}</div>
            <div className="cw-header-actions">
              <span className="cw-status">{t("live")}</span>

              <button
                type="button"
                className="cw-collapse"
                onClick={() => setIsChipsCollapsed((prev) => !prev)}
              >
                {isChipsCollapsed ? t("expandChips") : t("collapseChips")}
              </button>

              <button type="button" className="cw-close" onClick={() => setOpen(false)}>
                {t("close")}
              </button>
            </div>
          </div>

          <div className="cw-tabs">
            {categories.map((c) => (
              <button
                key={c.key}
                className={`cw-tab ${category === c.key ? "active" : ""}`}
                onClick={() => setCategory(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cw-chips" style={{ height: chipsHeight }}>
          {quickChips.map((chip) => (
            <button key={chip} className="cw-chip" onClick={() => send(chip)}>
              {chip}
            </button>
          ))}
        </div>

        <div
          className="cw-chips-resizer"
          onMouseDown={handleChipsResizeStart}
          title={t("resizeChips")}
        >
          <span></span>
        </div>

        <div className="cw-body">
          {messages.map((msg, idx) => (
            <div key={idx} className={`cw-msg ${msg.role}`}>
              {msg.type === "text" && <div className={`cw-bubble ${msg.role}`}>{msg.text}</div>}

              {msg.type === "cards" && (
                <div className="cw-cards">
                  {(msg.matched || []).map((id) => (
                    <button key={id} className="cw-card" onClick={() => openCard(id)}>
                      <div className="cw-card-id">{id}</div>
                      <div className="cw-card-open">{t("viewDetail")}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="cw-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("placeholder")}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
          />
          <button onClick={() => send(input)}>{t("send")}</button>
        </div>

        {selectedCard && (
          <div className="cw-sheet">
            <div className="cw-sheet-head">
              <div className="cw-sheet-title">{selectedCard.title}</div>
              <button className="cw-x" onClick={() => setSelectedCard(null)}>
                {t("close")}
              </button>
            </div>

            <div className="cw-section">
              <div className="cw-section-title">{t("quick")}</div>
              <ul>
                {(selectedCard.quickChecks || []).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>

            <div className="cw-section">
              <div className="cw-section-title">{t("steps")}</div>
              <ol>
                {(selectedCard.steps || []).map((s, i) => (
                  <li key={i}>
                    <b>{s.label}</b>
                    <div>{s.detail}</div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
