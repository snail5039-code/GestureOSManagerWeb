// src/pages/board/Board.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useModal } from "../../context/ModalContext";
import { useAuth } from "../../auth/AuthProvider";
import { BOARD_TYPES } from "./BoardTypes";
import { useTranslation } from "react-i18next";

const SORT_OPTIONS = [
  { value: "latest", key: "latest" },
  { value: "views", key: "views" },
  { value: "comments", key: "comments" },
];

const getStoredBoardId = () => {
  if (typeof window === "undefined") return 2;
  const stored = Number(window.sessionStorage.getItem("boardId"));
  return !Number.isNaN(stored) && stored > 0 ? stored : 2;
};

const resolveBoardId = (typeParam) => {
  if (!typeParam) return getStoredBoardId();
  const numeric = Number(typeParam);
  if (!Number.isNaN(numeric) && numeric > 0) return numeric;
  return BOARD_TYPES.find((b) => b.key === typeParam)?.id ?? getStoredBoardId();
};

const resolveBoardKey = (id) => BOARD_TYPES.find((b) => b.id === id)?.key ?? String(id);

const getStoredSortType = () => {
  if (typeof window === "undefined") return "latest";
  const stored = window.sessionStorage.getItem("boardSortType");
  return stored || "latest";
};

const getStoredPageSize = () => {
  if (typeof window === "undefined") return 10;
  const stored = Number(window.sessionStorage.getItem("boardPageSize"));
  return !Number.isNaN(stored) && stored > 0 ? stored : 10;
};

const getStoredSearchType = () => {
  if (typeof window === "undefined") return "title";
  const stored = window.sessionStorage.getItem("boardSearchType");
  return stored || "title";
};

const getStoredPage = (id) => {
  if (typeof window === "undefined") return 1;
  const stored = Number(window.sessionStorage.getItem(`boardPage:${id}`));
  return !Number.isNaN(stored) && stored > 0 ? stored : 1;
};

// ✅ 고정 QnA 대상 boardId
const QNA_BOARD_ID = 3;

// ✅ 백에서 내려오는 pinned 필드 이름이 다를 수 있으니 안전하게 흡수
const getPinnedFlag = (b) => Boolean(b?.isPinned ?? b?.is_pinned ?? false);
const getPinnedOrder = (b) => {
  const v = b?.pinnedOrder ?? b?.pinned_order ?? null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function Board() {
  const { t } = useTranslation("board");
  const { showModal } = useModal();
  const { user } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get("type");
  const initialBoardId = resolveBoardId(typeParam);

  const [cPage, setCPage] = useState(() => getStoredPage(initialBoardId));
  const [boardId, setBoardId] = useState(() => initialBoardId);
  const [boards, setBoards] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchType, setSearchType] = useState(() => getStoredSearchType());
  const [pageSize, setPageSize] = useState(() => getStoredPageSize());
  const [sortType, setSortType] = useState(() => getStoredSortType());

  const [pageInfo, setPageInfo] = useState({
    totalPagesCnt: 1,
    begin: 1,
    end: 1,
  });
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();

  useEffect(() => {
    const nextId = resolveBoardId(typeParam);
    if (nextId !== boardId) {
      setBoardId(nextId);
    }
  }, [typeParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("boardId", String(boardId));
    }
  }, [boardId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("boardSortType", sortType);
    }
  }, [sortType]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("boardPageSize", String(pageSize));
    }
  }, [pageSize]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("boardSearchType", searchType);
    }
  }, [searchType]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`boardPage:${boardId}`, String(cPage));
    }
  }, [boardId, cPage]);

  useEffect(() => {
    setSearchInput(searchKeyword);
  }, [searchKeyword]);

  const fetchBoards = async () => {
    try {
      setLoading(true);
      const res = await api.get("/boards", {
        params: { boardId, cPage, searchType, searchKeyword, pageSize, sortType },
      });

      const totalPagesCnt = res.data.totalPagesCnt ?? 1;
      const begin = res.data.begin ?? 1;
      const end = res.data.end ?? totalPagesCnt;

      setBoards(res.data.articles || []);
      setPageInfo({ totalPagesCnt, begin, end });

      if (cPage > totalPagesCnt) setCPage(totalPagesCnt);
    } catch (e) {
      console.error(e);
      showModal({ title: t("modal.errorTitle"), message: t("modal.loadFail"), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, [boardId, cPage, pageSize, searchType, searchKeyword, sortType]); // eslint-disable-line react-hooks/exhaustive-deps

  const didInit = useRef(false);

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      return;
    }
    setCPage(1);
  }, [boardId, pageSize, searchType, searchKeyword, sortType]);

  const handleBoardChange = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("type", resolveBoardKey(id));
    setSearchParams(next, { replace: true });
  };

  const handleSearch = () => {
    setSearchKeyword(searchInput.trim());
    setCPage(1);
  };

  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let i = pageInfo.begin; i <= pageInfo.end; i++) pages.push(i);
    return pages.length > 0 ? pages : [1];
  }, [pageInfo]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  // ✅ 로그인 체크 + 관리자 체크
  const isLoggedIn = Boolean(user?.id); // AuthProvider에서 user에 id가 없으면 Boolean(user)로 바꿔도 됨
  const role = typeof user?.role === "string" ? user.role : "";
  const isAdmin = role.toLowerCase().includes("admin") || role.includes("관리자");

  // ✅ 비로그인: 글쓰기 버튼 숨김
  // ✅ 공지(boardId=1): 관리자만 글쓰기
  const canWrite = isLoggedIn && (boardId !== 1 || isAdmin);

  const boardLabel = (id) => {
    const key = BOARD_TYPES.find((b) => b.id === id)?.key;
    if (!key) return t("board.default");
    return t(`board.types.${key}`);
  };

  const isQnaBoard = boardId === QNA_BOARD_ID;

  return (
    <div className="min-h-screen text-[var(--text)]">
      <div className="mx-auto max-w-[1200px]">
        {/* top controls */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <button className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-6 py-3 text-sm text-[var(--text)] transition-all hover:border-[var(--accent)]">
                {boardLabel(boardId)}
                <svg className="h-5 w-5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div className="absolute top-full left-0 mt-2 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top scale-95 group-hover:scale-100 z-50">
                {BOARD_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleBoardChange(type.id)}
                    className="w-full rounded-lg px-4 py-2 text-left text-sm text-[var(--muted)] hover:bg-[rgba(37,99,235,0.10)] hover:text-[var(--text)] transition-all"
                  >
                    {boardLabel(type.id)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--muted)]">{t("sort")}</span>
            <select
              value={sortType}
              onChange={(e) => {
                setSortType(e.target.value);
                setCPage(1);
              }}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-xs text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`sortOptions.${opt.key}`)}
                </option>
              ))}
            </select>

            <span className="text-xs text-[var(--muted)]">{t("list")}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCPage(1);
              }}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-xs text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
            >
              <option value={10}>{t("pageSize.10")}</option>
              <option value={20}>{t("pageSize.20")}</option>
              <option value={30}>{t("pageSize.30")}</option>
            </select>
          </div>
        </div>

        {/* table card */}
        <div className="glass mb-8 overflow-hidden rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-soft)]">
                <th className="w-20 px-8 py-4 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] whitespace-nowrap">
                  {t("table.no")}
                </th>
                <th className="px-8 py-4 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                  {t("table.title")}
                </th>
                <th className="w-36 px-8 py-4 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] whitespace-nowrap">
                  {t("table.writer")}
                </th>
                <th className="w-36 px-8 py-4 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] whitespace-nowrap">
                  {t("table.date")}
                </th>
                <th className="w-24 px-8 py-4 text-center text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] whitespace-nowrap">
                  {t("table.views")}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-sm text-[var(--muted)]">
                    {t("loading")}
                  </td>
                </tr>
              ) : boards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-sm text-[var(--muted)]">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                boards.map((b) => {
                  const isPinned = getPinnedFlag(b);
                  const pinnedOrder = getPinnedOrder(b);

                  const showPinnedUi = isQnaBoard && isPinned;
                  const noText = showPinnedUi && pinnedOrder ? String(pinnedOrder) : String(b.id);

                  return (
                    <tr
                      key={b.id}
                      onClick={() => nav(`/board/${b.id}`)}
                      className={[
                        "group cursor-pointer transition-colors hover:bg-[rgba(37,99,235,0.08)]",
                        showPinnedUi ? "bg-[rgba(37,99,235,0.06)]" : "",
                      ].join(" ")}
                    >
                      <td className="px-8 py-5 text-sm text-[var(--muted)]">
                        <div className="flex items-center gap-2">
                          <span>{noText}</span>

                          {showPinnedUi && (
                            <span className="inline-flex items-center rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)] border border-[var(--accent)]/25">
                              PIN
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-[var(--text)] transition-colors group-hover:text-[var(--accent)]">
                            {b.title}
                          </span>

                          {b.commentCount > 0 && (
                            <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] text-[var(--accent)]">
                              {b.commentCount}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-8 py-5 text-sm text-[var(--muted)] whitespace-nowrap">
                        {b.writerName || t("anonymous")}
                      </td>
                      <td className="px-8 py-5 text-sm text-[var(--muted)] whitespace-nowrap">
                        {formatDate(b.regDate)}
                      </td>
                      <td className="px-8 py-5 text-center text-sm text-[var(--muted)] whitespace-nowrap">
                        {b.hit || 0}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* pagination + search/write */}
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCPage(1)}
              disabled={cPage === 1}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 transition-all bg-[var(--surface-soft)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={() => setCPage(Math.max(1, cPage - 1))}
              disabled={cPage === 1}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 transition-all bg-[var(--surface-soft)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {pageNumbers.map((p) => (
              <button
                key={p}
                onClick={() => setCPage(p)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm transition-all ${
                  cPage === p
                    ? "bg-[var(--accent)] text-white shadow-[0_10px_25px_rgba(37,99,235,0.25)]"
                    : "text-[var(--muted)] hover:text-[var(--text)] bg-[transparent]"
                }`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => setCPage(Math.min(pageInfo.totalPagesCnt, cPage + 1))}
              disabled={cPage >= pageInfo.totalPagesCnt}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 transition-all bg-[var(--surface-soft)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={() => setCPage(pageInfo.totalPagesCnt)}
              disabled={cPage >= pageInfo.totalPagesCnt}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 transition-all bg-[var(--surface-soft)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-1 justify-center">
              <div className="flex w-full max-w-2xl items-center gap-2 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-soft)] p-2">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="bg-transparent pl-4 pr-2 py-2 text-xs text-[var(--muted)] outline-none"
                >
                  <option value="title">{t("search.type.title")}</option>
                  <option value="content">{t("search.type.content")}</option>
                  <option value="title,content">{t("search.type.titleContent")}</option>
                </select>

                <div className="h-4 w-[1px] bg-[var(--border)]"></div>

                <input
                  type="text"
                  placeholder={t("search.placeholder")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 bg-transparent px-4 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                />

                <button
                  onClick={handleSearch}
                  className="rounded-lg bg-[var(--accent)] px-6 py-2 text-xs text-white hover:bg-[var(--accent-strong)] transition-all active:scale-95"
                >
                  {t("search.button")}
                </button>
              </div>
            </div>

            {canWrite && (
              <button
                onClick={() => nav(`/board/write?boardId=${boardId}`)}
                className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-xs text-white shadow-[0_18px_35px_rgba(37,99,235,0.25)] hover:bg-[var(--accent-strong)] transition-all active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                {t("write")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
