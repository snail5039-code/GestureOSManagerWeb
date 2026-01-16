import React, { useEffect, useState, useCallback } from "react";
import { api } from "../../api/client";
import CommentItem from "./CommentItem";
import CommentWrite from "./CommentWrite";
import { useTranslation } from "react-i18next"

export default function CommentSection({ relTypeCode = "article", relId }) {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation("board");

    const fetchComments = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/comments/${relTypeCode}/${relId}`);
            setComments(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [relTypeCode, relId]);

    useEffect(() => {
        if (relId) fetchComments();
    }, [relId, fetchComments]);

    // 댓글과 대댓글 그룹화
    const rootComments = comments.filter((c) => !c.parentId);
    const getReplies = (parentId) => comments.filter((c) => c.parentId === parentId);

    return (
        <div className="mt-10 border-t pt-8">
            <h3 className="text-lg font-bold mb-4"> {t("comment.count", { count: comments.length })}</h3>

            {/* 댓글 작성 */}
            <CommentWrite relTypeCode={relTypeCode} relId={relId} onSuccess={fetchComments} />

            {/* 댓글 목록 */}
            <div className="mt-8 divide-y">
                {loading && comments.length === 0 ? (
                    <div className="py-10 text-center text-gray-400">{t("comment.loading")}</div>
                ) : rootComments.length === 0 ? (
                    <div className="py-10 text-center text-gray-400">{t("comment.empty")}</div>
                ) : (
                    rootComments.map((comment) => (
                        <div key={comment.id}>
                            <CommentItem
                                comment={comment}
                                relTypeCode={relTypeCode}
                                relId={relId}
                                onRefresh={fetchComments}
                            />
                            {/* 대댓글 렌더링 */}
                            {getReplies(comment.id).map((reply) => (
                                <CommentItem
                                    key={reply.id}
                                    comment={reply}
                                    relTypeCode={relTypeCode}
                                    relId={relId}
                                    onRefresh={fetchComments}
                                />
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
