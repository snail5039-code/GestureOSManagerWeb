import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useTranslation } from "react-i18next";
import CommentWrite from "./CommentWrite";
import CommentItem from "./CommentItem";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function normalizeRelType(relTypeCode) {
  const raw = String(relTypeCode || "").trim();
  if (!raw) return "";
  return raw.toUpperCase();
}

// ✅ flat -> tree (parentId 기반)
function buildCommentTree(list) {
  const safe = Array.isArray(list) ? list : [];
  const map = new Map();
  const roots = [];

  // clone + children
  for (const item of safe) {
    if (!item || item.id == null) continue;
    map.set(item.id, { ...item, children: [] });
  }

  for (const item of map.values()) {
    const pid = item.parentId;
    if (pid != null && map.has(pid)) {
      map.get(pid).children.push(item);
    } else {
      roots.push(item);
    }
  }

  // 정렬(원하면 regDate 기준으로 바꿔도 됨)
  const sortFn = (a, b) => (a.id ?? 0) - (b.id ?? 0);
  const sortDeep = (arr) => {
    arr.sort(sortFn);
    for (const x of arr) sortDeep(x.children || []);
  };
  sortDeep(roots);

  return roots;
}

export default function CommentSection({ relTypeCode, relId }) {
  const { t } = useTranslation("board");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [comments, setComments] = useState([]);

  // ✅ 이미지 캐시 방지(댓글 아바타 갱신 반영용)
  const avatarBust = useMemo(() => String(Date.now()), []);

  const relTypeUpper = useMemo(() => normalizeRelType(relTypeCode), [relTypeCode]);
  const relTypeLower = useMemo(() => (relTypeUpper ? relTypeUpper.toLowerCase() : ""), [relTypeUpper]);

  const fetchComments = useCallback(async () => {
    if (!relId || !relTypeUpper) return;

    setLoading(true);
    setErr(null);

    const tries = [
      () => api.get("/comments", { params: { relTypeCode: relTypeUpper, relId } }),
      () => api.get("/comments", { params: { relTypeCode: relTypeLower, relId } }),
      () => api.get(`/comments/${relTypeUpper}/${relId}`),
      () => api.get(`/comments/${relTypeLower}/${relId}`),
    ];

    let lastError = null;

    for (const run of tries) {
      try {
        const res = await run();
        const list = res?.data?.data ?? res?.data ?? [];
        setComments(Array.isArray(list) ? list : []);
        setLoading(false);
        return;
      } catch (e) {
        lastError = e;
      }
    }

    console.error("[COMMENTS_LOAD_FAIL]", lastError);
    const status = lastError?.response?.status;
    const msg =
      lastError?.response?.data?.message ||
      lastError?.response?.data?.error ||
      lastError?.message ||
      "Failed to load comments";

    setErr({ status, msg, raw: lastError?.response?.data });
    setLoading(false);
  }, [relId, relTypeUpper, relTypeLower]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const tree = useMemo(() => buildCommentTree(comments), [comments]);

  const handleRefresh = async () => {
    await fetchComments();
  };

  return (
    <section className="mt-10 text-[var(--text)]">
      <div className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-xl p-8 shadow-[0_22px_60px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-black text-[var(--text-strong)]">
            {t("comment.title", { defaultValue: "댓글" })}
          </h3>

          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 px-4 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]/40 transition-all"
          >
            {t("comment.refresh", { defaultValue: "새로고침" })}
          </button>
        </div>

        {/* ✅ 작성 */}
        <CommentWrite relTypeCode={relTypeUpper} relId={relId} onSuccess={handleRefresh} />

        {/* ✅ 로딩/에러/리스트 */}
        <div className="mt-6">
          {loading && <div className="py-8 text-sm text-[var(--muted)]">Loading...</div>}

          {!loading && err && (
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700">
              <div className="font-black">
                {t("comment.loadFail", { defaultValue: "댓글을 불러오지 못했어요." })}
                {err.status ? ` (HTTP ${err.status})` : ""}
              </div>
              <div className="mt-1 text-xs text-rose-700/80 break-all">{err.msg}</div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-black text-white hover:bg-[var(--accent-strong)] transition-all"
                >
                  {t("comment.retry", { defaultValue: "재시도" })}
                </button>
              </div>

              <div className="mt-3 text-[11px] text-rose-700/70">
                ✅ 이 에러는 서버 인증(401)일 가능성이 높아요. 요청 헤더에 토큰/쿠키가 붙는지 확인하세요.
              </div>
            </div>
          )}

          {!loading && !err && tree.length === 0 && (
            <div className="py-10 text-center text-sm text-[var(--muted)]">
              {t("comment.empty", { defaultValue: "아직 댓글이 없어요." })}
            </div>
          )}

          {!loading && !err && tree.length > 0 && (
            <div className="space-y-3">
              {tree.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  relTypeCode={relTypeUpper}
                  relId={relId}
                  avatarBust={avatarBust}
                  onChanged={handleRefresh}
                  depth={0}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
