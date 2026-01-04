import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./ChatWidget.css";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  // ✅ 훅은 무조건 컴포넌트 안!
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("camera");

  const [input, setInput] = useState("");
  const [cards, setCards] = useState([]);
  const [messages, setMessages] = useState([
    { role: "assistant", type: "text", text: "문제 유형을 고르거나, 아래 칩을 눌러봐!" },
  ]);
  const [selectedCard, setSelectedCard] = useState(null);

  // ✅ 카테고리 목록 서버에서 받아오기 (하드코딩 제거)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await axios.get("/api/help/categories");
        if (!alive) return;

        const arr = (res.data || []).map((key) => ({
          key,
          label: key, // 필요하면 여기서 한글 라벨로 매핑 가능
        }));

        setCategories(arr);

        // 서버 카테고리 중 첫번째로 기본값 맞추기
        if (arr.length && !arr.find((c) => c.key === category)) {
          setCategory(arr[0].key);
        }
      } catch {
        if (!alive) return;
        // fallback (서버가 아직 없거나 실패할 때)
        const fallback = [
          { key: "camera", label: "camera" },
          { key: "error", label: "error" },
          { key: "call", label: "call" },
        ];
        setCategories(fallback);
      }
    })();

    return () => (alive = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 카테고리별 카드 목록 로드 (칩 생성용)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(`/api/help/cards?category=${category}`);
        if (!alive) return;
        setCards(res.data || []);
      } catch {
        if (!alive) return;
        setCards([]);
      }
    })();
    return () => (alive = false);
  }, [category]);

  const quickChips = useMemo(() => {
    const arr = [];
    for (const c of cards) {
      if (c.symptoms?.length) arr.push(...c.symptoms);
      if (c.title) arr.push(c.title);
      if (arr.length >= 10) break;
    }
    return [...new Set(arr)].slice(0, 8);
  }, [cards]);

  const send = async (text) => {
    const t = (text || "").trim();
    if (!t) return;

    setMessages((m) => [...m, { role: "user", type: "text", text: t }]);
    setInput("");

    try {
      const res = await axios.post("/api/help/chat", {
        message: t,
        context: { category },
      });

      const data = res.data || {};
      const matched = data.matched || [];

      setMessages((m) => [
        ...m,
        { role: "assistant", type: "text", text: data.text || "관련 해결 방법을 찾았어!" },
        { role: "assistant", type: "cards", matched },
      ]);
      
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", type: "text", text: "요청 실패! (백엔드 켜짐/프록시 설정 확인)" },
      ]);
    }
  };

  const openCard = async (id) => {
    try {
      const res = await axios.get(`/api/help/cards/${id}`);
      setSelectedCard(res.data);
    } catch {
      setSelectedCard(null);
    }
  };

  return (
    <>
      <button className="cw-fab" onClick={() => setOpen((v) => !v)}>
        {open ? "닫기" : "챗봇"}
      </button>

      {open && (
        <div className="cw-panel">
          <div className="cw-header">
            <div className="cw-title">도움말 챗봇</div>

            <div className="cw-tabs">
              {/* ✅ CATEGORIES 말고 categories state 사용 */}
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

          <div className="cw-chips">
            {quickChips.map((chip) => (
              <button key={chip} className="cw-chip" onClick={() => send(chip)}>
                {chip}
              </button>
            ))}
          </div>

          <div className="cw-body">
            {messages.map((msg, idx) => (
              <div key={idx} className={`cw-msg ${msg.role}`}>
                {msg.type === "text" && <div className="cw-bubble">{msg.text}</div>}

                {msg.type === "cards" && (
                  <div className="cw-cards">
                    {(msg.matched || []).map((id) => (
                      <button key={id} className="cw-card" onClick={() => openCard(id)}>
                        <div className="cw-card-id">{id}</div>
                        <div className="cw-card-open">상세 보기</div>
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
              placeholder="예: 검은 화면 / CORS / 상대 영상 안 뜸"
              onKeyDown={(e) => e.key === "Enter" && send(input)}
            />
            <button onClick={() => send(input)}>전송</button>
          </div>

          {selectedCard && (
            <div className="cw-sheet">
              <div className="cw-sheet-head">
                <div className="cw-sheet-title">{selectedCard.title}</div>
                <button className="cw-x" onClick={() => setSelectedCard(null)}>
                  ✕
                </button>
              </div>

              <div className="cw-section">
                <div className="cw-section-title">빠른 체크</div>
                <ul>
                  {(selectedCard.quickChecks || []).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>

              <div className="cw-section">
                <div className="cw-section-title">단계별 해결</div>
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
      )}
    </>
  );
}
