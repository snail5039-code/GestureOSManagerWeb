import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";

export default function MyPage() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("articles"); // "articles", "comments", "likes"
    const nav = useNavigate();

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const res = await api.get("/mypage");
                setData(res.data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) return <div className="p-20 text-center">로딩 중...</div>;
    if (!data) return <div className="p-20 text-center">데이터를 불러오지 못했습니다.</div>;

    const { member, stats, myArticles, myComments, likedArticles } = data;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-extrabold mb-8">마이페이지</h1>

            {/* 프로필 섹션 */}
            <div className="bg-white border rounded-2xl p-8 mb-8 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center text-3xl">
                        👤
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{member.name}</h2>
                        <p className="text-gray-500">{member.email}</p>
                        <div className="mt-2 flex gap-2">
                            <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                                {member.role === "ADMIN" ? "관리자" : "일반회원"}
                            </span>
                            <span className="px-3 py-1 bg-indigo-50 rounded-full text-xs font-medium text-indigo-600">
                                가입일: {member.regDate?.split("T")[0]}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 통계 섹션 */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white border rounded-2xl p-6 text-center shadow-sm">
                    <div className="text-gray-400 text-sm mb-1">작성한 글</div>
                    <div className="text-2xl font-bold text-indigo-600">{stats.articleCount}</div>
                </div>
                <div className="bg-white border rounded-2xl p-6 text-center shadow-sm">
                    <div className="text-gray-400 text-sm mb-1">작성한 댓글</div>
                    <div className="text-2xl font-bold text-indigo-600">{stats.commentCount}</div>
                </div>
                <div className="bg-white border rounded-2xl p-6 text-center shadow-sm">
                    <div className="text-gray-400 text-sm mb-1">받은 좋아요</div>
                    <div className="text-2xl font-bold text-indigo-600">{stats.likeCount}</div>
                </div>
            </div>

            {/* 활동 탭 섹션 */}
            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab("articles")}
                        className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === "articles" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-400 hover:text-gray-600"
                            }`}
                    >
                        내 게시글
                    </button>
                    <button
                        onClick={() => setActiveTab("comments")}
                        className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === "comments" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-400 hover:text-gray-600"
                            }`}
                    >
                        내 댓글
                    </button>
                    <button
                        onClick={() => setActiveTab("likes")}
                        className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === "likes" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-400 hover:text-gray-600"
                            }`}
                    >
                        좋아요 한 글
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === "articles" && (
                        <ul className="divide-y">
                            {myArticles.length === 0 ? (
                                <li className="py-10 text-center text-gray-400">작성한 글이 없습니다.</li>
                            ) : (
                                myArticles.map((a) => (
                                    <li
                                        key={a.id}
                                        className="py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => nav(`/board/${a.id}`)}
                                    >
                                        <div className="font-medium">{a.title}</div>
                                        <div className="text-xs text-gray-400 mt-1">{a.regDate}</div>
                                    </li>
                                ))
                            )}
                        </ul>
                    )}

                    {activeTab === "comments" && (
                        <ul className="divide-y">
                            {myComments.length === 0 ? (
                                <li className="py-10 text-center text-gray-400">작성한 댓글이 없습니다.</li>
                            ) : (
                                myComments.map((c) => (
                                    <li
                                        key={c.id}
                                        className="py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => {
                                            if (c.relTypeCode === 'article') {
                                                nav(`/board/${c.relId}`);
                                            }
                                        }}
                                    >
                                        <div className="text-sm text-gray-800 line-clamp-1">{c.content}</div>
                                        <div className="text-xs text-gray-400 mt-1">{c.updateDate}</div>
                                    </li>
                                ))
                            )}
                        </ul>
                    )}

                    {activeTab === "likes" && (
                        <ul className="divide-y">
                            {likedArticles.length === 0 ? (
                                <li className="py-10 text-center text-gray-400">좋아요 한 글이 없습니다.</li>
                            ) : (
                                likedArticles.map((a) => (
                                    <li
                                        key={a.id}
                                        className="py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => nav(`/board/${a.id}`)}
                                    >
                                        <div className="font-medium">{a.title}</div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            작성자: {a.writerName} | {a.regDate}
                                        </div>
                                    </li>
                                ))
                            )}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
