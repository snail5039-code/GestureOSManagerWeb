package com.example.demo.service;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import com.example.demo.dao.CommentDao;
import com.example.demo.dao.MemberDao;
import com.example.demo.dto.Comment;
import com.example.demo.dto.Member;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CommentService {
    private final CommentDao commentDao;
    private final MemberDao memberDao;
    private final ReactionService reactionService;

    public List<Comment> getCommentsByRel(String relTypeCode, int relId, Integer loginMemberId) {
        List<Comment> comments = commentDao.selectByRel(relTypeCode, relId);

        Member loginMember = null;
        if (loginMemberId != null) {
            loginMember = memberDao.findById(loginMemberId);
        }

        for (Comment c : comments) {
            // 좋아요 정보 설정
            c.setLikeCount(reactionService.getReactionCount("comment", c.getId()));
            if (loginMemberId != null) {
                c.setIsLiked(reactionService.hasReacted("comment", c.getId(), loginMemberId));
            } else {
                c.setIsLiked(false);
            }

            if (loginMemberId != null && loginMember != null) {
                boolean isWriter = c.getMemberId().equals(loginMemberId);
                boolean isAdmin = "ADMIN".equals(loginMember.getRole());
                c.setCanModify(isWriter || isAdmin);
                c.setCanDelete(isWriter || isAdmin);
            } else {
                c.setCanModify(false);
                c.setCanDelete(false);
            }
        }
        return comments;
    }

    public void writeComment(Comment comment, int loginMemberId) {
        comment.setMemberId(loginMemberId);
        commentDao.insert(comment);
    }

    public void modifyComment(Comment comment, int loginMemberId) {
        Comment existing = commentDao.selectById(comment.getId());
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 댓글이 존재하지 않습니다.");
        }

        Member loginMember = memberDao.findById(loginMemberId);
        boolean isWriter = existing.getMemberId().equals(loginMemberId);
        boolean isAdmin = "ADMIN".equals(loginMember.getRole());

        if (!isWriter && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "수정 권한이 없습니다.");
        }

        commentDao.update(comment);
    }

    public void deleteComment(int id, int loginMemberId) {
        Comment existing = commentDao.selectById(id);
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 댓글이 존재하지 않습니다.");
        }

        Member loginMember = memberDao.findById(loginMemberId);
        boolean isWriter = existing.getMemberId().equals(loginMemberId);
        boolean isAdmin = "ADMIN".equals(loginMember.getRole());

        if (!isWriter && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "삭제 권한이 없습니다.");
        }

        commentDao.delete(id);
    }
}
