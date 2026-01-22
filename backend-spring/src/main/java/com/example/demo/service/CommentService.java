package com.example.demo.service;

import java.lang.reflect.Method;
import java.util.*;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
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

    // ✅ principal이 어떤 타입이든 최대한 memberId 뽑기
    public Integer extractLoginMemberId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) return null;

        Object p = auth.getPrincipal();
        if (p == null) return parseIntSafe(auth.getName());

        // 1) 숫자 직접
        if (p instanceof Integer i) return i;
        if (p instanceof Long l) return l.intValue();

        // 2) String이면 숫자 시도
        if (p instanceof String s) {
            Integer v = parseIntSafe(s);
            if (v != null) return v;
            return parseIntSafe(auth.getName());
        }

        // 3) UserDetails면 username에서 숫자 시도
        if (p instanceof UserDetails ud) {
            Integer v = parseIntSafe(ud.getUsername());
            if (v != null) return v;
            return parseIntSafe(auth.getName());
        }

        // 4) 커스텀 객체면 getId()/getMemberId() 리플렉션 시도
        Integer v = reflectInt(p, "getId");
        if (v != null) return v;
        v = reflectInt(p, "getMemberId");
        if (v != null) return v;

        // 5) 마지막: auth.getName()
        return parseIntSafe(auth.getName());
    }

    private Integer reflectInt(Object obj, String methodName) {
        try {
            Method m = obj.getClass().getMethod(methodName);
            Object r = m.invoke(obj);
            if (r instanceof Integer i) return i;
            if (r instanceof Long l) return l.intValue();
            if (r instanceof String s) return parseIntSafe(s);
            return null;
        } catch (Exception ignore) {
            return null;
        }
    }

    private Integer parseIntSafe(String s) {
        if (s == null) return null;
        try {
            return Integer.parseInt(s.trim());
        } catch (Exception e) {
            return null;
        }
    }

    public List<Comment> getCommentsByRel(String relTypeCode, int relId, Integer loginMemberId) {
        List<Comment> comments = commentDao.selectByRel(relTypeCode, relId);

        Member loginMember = null;
        if (loginMemberId != null) {
            loginMember = memberDao.findById(loginMemberId);
        }

        for (Comment c : comments) {
            // ✅ reaction 쪽 문제로 목록까지 500 나지 않게 방어
            try {
                c.setLikeCount(reactionService.getReactionCount("comment", c.getId()));
                c.setIsLiked(loginMemberId != null && reactionService.hasReacted("comment", c.getId(), loginMemberId));
            } catch (Exception e) {
                c.setLikeCount(0);
                c.setIsLiked(false);
            }

            if (loginMemberId != null && loginMember != null) {
                boolean isWriter = (c.getMemberId() != null) && c.getMemberId().equals(loginMemberId);
                boolean isAdmin = "ADMIN".equalsIgnoreCase(loginMember.getRole());
                c.setCanEdit(isWriter || isAdmin);
                c.setCanDelete(isWriter || isAdmin);
            } else {
                c.setCanEdit(false);
                c.setCanDelete(false);
            }
        }

        return comments;
    }

    public void writeComment(Comment comment, int loginMemberId) {
        if (comment == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 요청입니다.");
        if (comment.getContent() == null || comment.getContent().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "내용을 입력해 주세요.");
        }
        comment.setMemberId(loginMemberId);
        commentDao.insert(comment);
    }

    public void modifyComment(Comment comment, int loginMemberId) {
        if (comment == null || comment.getId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 요청입니다.");
        }

        Comment existing = commentDao.selectById(comment.getId());
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 댓글이 존재하지 않습니다.");
        }

        Member loginMember = memberDao.findById(loginMemberId);
        boolean isWriter = existing.getMemberId() != null && existing.getMemberId().equals(loginMemberId);
        boolean isAdmin = loginMember != null && "ADMIN".equalsIgnoreCase(loginMember.getRole());

        if (!isWriter && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "수정 권한이 없습니다.");
        }

        if (comment.getContent() == null || comment.getContent().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "내용을 입력해 주세요.");
        }

        commentDao.update(comment);
    }

    public void deleteComment(int id, int loginMemberId) {
        Comment existing = commentDao.selectById(id);
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 댓글이 존재하지 않습니다.");
        }

        Member loginMember = memberDao.findById(loginMemberId);
        boolean isWriter = existing.getMemberId() != null && existing.getMemberId().equals(loginMemberId);
        boolean isAdmin = loginMember != null && "ADMIN".equalsIgnoreCase(loginMember.getRole());

        if (!isWriter && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "삭제 권한이 없습니다.");
        }

        // ✅ 대댓글까지 같이 삭제 (orphan 방지)
        deleteRecursive(id);
    }

    private void deleteRecursive(int parentId) {
        List<Integer> childIds = commentDao.selectChildIds(parentId);
        if (childIds != null) {
            for (Integer cid : childIds) {
                if (cid != null) deleteRecursive(cid);
            }
        }
        commentDao.delete(parentId);
    }
}
