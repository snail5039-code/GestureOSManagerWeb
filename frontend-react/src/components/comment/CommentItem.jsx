import React, { useState } from "react";
import { api } from "../../api/client";
import CommentWrite from "./CommentWrite";
import LikeButton from "../common/LikeButton";
import { useTranslation } from "react-i18next"

export default function CommentItem({ comment, relTypeCode, relId, onRefresh }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(comment.content);
    const [isReplying, setIsReplying] = useState(false);
    const { t } = useTranslation("board");

    const handleUpdate = async () => {
        try {
            await api.put(`/comments/${comment.id}`, {
                content: editContent,
            });
            setIsEditing(false);
            onRefresh();
        } catch (e) {
            console.error(e);
            alert(t("comment.editFail"));
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(t("comment.confirmDelete"))) return;
        try {
            await api.delete(`/comments/${comment.id}`);
            onRefresh();
        } catch (e) {
            console.error(e);
            alert(t("comment.deleteFail"));
        }
    };

    return (
        <div className={`py-4 ${comment.parentId ? "ml-10 border-l pl-4 bg-gray-50/50" : ""}`}>
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{comment.writerName}</span>
                    <span className="text-xs text-gray-400">{comment.updateDate}</span>
                    <LikeButton
                        targetId={comment.id}
                        targetType="comment"
                        initialLiked={comment.isLiked}
                        initialCount={comment.likeCount}
                    />
                </div>

                <div className="flex gap-2">
                    {!comment.parentId && (
                        <button
                            onClick={() => setIsReplying(!isReplying)}
                            className="text-xs text-blue-600 hover:underline"
                        >
                            {t("comment.reply")}
                        </button>
                    )}
                    {comment.canModify && (
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="text-xs text-gray-500 hover:underline"
                        >
                            {isEditing ? t("comment.cancel") : t("comment.edit")}
                        </button>
                    )}
                    {comment.canDelete && (
                        <button
                            onClick={handleDelete}
                            className="text-xs text-red-500 hover:underline"
                        >
                            {t("comment.delete")}
                        </button>
                    )}
                </div>
            </div>

            {isEditing ? (
                <div className="mt-2">
                    <textarea
                        className="w-full border rounded-xl p-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-200"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                    />
                    <div className="flex justify-end mt-1">
                        <button
                            onClick={handleUpdate}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg"
                        >
                            {t("comment.save")}
                        </button>
                    </div>
                </div>
            ) : (
                <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                    {comment.content}
                </p>
            )}

            {isReplying && (
                <div className="mt-4">
                    <CommentWrite
                        relTypeCode={relTypeCode}
                        relId={relId}
                        parentId={comment.id}
                        onSuccess={() => {
                            setIsReplying(false);
                            onRefresh();
                        }}
                        onCancel={() => setIsReplying(false)}
                    />
                </div>
            )}
        </div>
    );
}
