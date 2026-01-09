import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function makeRoomId() {
  // 짧고 보기 쉬운 방코드 (예: k9f3a2b1)
  return Math.random().toString(16).slice(2, 10);
}

export default function CallLobby() {
  const navigate = useNavigate();
  const [roomInput, setRoomInput] = useState("");

  const suggested = useMemo(() => makeRoomId(), []);

  const goRoom = (id) => {
    const roomId = (id || "").trim();
    if (!roomId) return;
    navigate(`/call/${encodeURIComponent(roomId)}`);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 위쪽 공백(헤더 느낌) */}
      <div className="mx-auto max-w-3xl px-6 pt-10 pb-6">
        <div className="text-xs text-slate-500">실시간 영상 통화</div>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">로비</h1>
        <p className="mt-2 text-sm text-slate-600">
          방을 새로 만들거나, 방 코드를 입력해서 입장해주세요.
        </p>
      </div>

      <div className="mx-auto max-w-3xl px-6 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          {/* 새 방 만들기 */}
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-slate-900">새 방 만들기</div>
            <div className="text-sm text-slate-600">
              추천 방 코드:{" "}
              <span className="font-mono font-semibold text-slate-900">
                {suggested}
              </span>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                onClick={() => goRoom(suggested)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.99]"
              >
                새 방 시작
              </button>

              <button
                onClick={() => {
                  navigator.clipboard?.writeText(suggested);
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                title="추천 방 코드를 복사"
              >
                코드 복사
              </button>
            </div>
          </div>

          <hr className="my-6 border-slate-200" />

          {/* 방 코드로 입장 */}
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-slate-900">방 코드로 입장</div>
            <p className="text-sm text-slate-600">
              상대가 준 방 코드를 입력하고 Enter 또는 입장 버튼을 눌러주세요.
            </p>

            <div className="mt-2 flex gap-2">
              <input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") goRoom(roomInput);
                }}
                placeholder="예: test123"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
              <button
                onClick={() => goRoom(roomInput)}
                className="rounded-xl border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                입장
              </button>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              팁: 같은 방 코드를 입력한 사람들끼리 연결돼요.
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          SLT 프로젝트 · React + Tailwind
        </div>
      </div>
    </div>
  );
}
