package com.example.demo.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dto.Comment;
import com.example.demo.service.CommentService;

import lombok.Data;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    private String normRelType(String relTypeCode) {
        return (relTypeCode == null) ? null : relTypeCode.trim().toLowerCase();
    }

    private Integer loginId(Authentication auth) {
        return commentService.extractLoginMemberId(auth);
    }

    // ✅ 프론트 방식 1) /api/comments?relTypeCode=article&relId=18
    @GetMapping
    public List<Comment> listByQuery(
            @RequestParam String relTypeCode,
            @RequestParam int relId,
            Authentication auth
    ) {
        return commentService.getCommentsByRel(normRelType(relTypeCode), relId, loginId(auth));
    }

    // ✅ 프론트 방식 2) /api/comments/{relTypeCode}/{relId}
    @GetMapping("/{relTypeCode}/{relId}")
    public List<Comment> listByPath(
            @PathVariable String relTypeCode,
            @PathVariable int relId,
            Authentication auth
    ) {
        return commentService.getCommentsByRel(normRelType(relTypeCode), relId, loginId(auth));
    }

    // ✅ 프론트 fallback까지 커버: POST /api/comments body {relTypeCode, relId, content, parentId}
    @PostMapping
    public Map<String, Object> writeByBody(
            @RequestBody WriteReq req,
            Authentication auth
    ) {
        Integer memberId = loginId(auth);
        if (memberId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");

        if (req == null || req.relTypeCode == null || req.relId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "relTypeCode/relId가 필요합니다.");
        }

        Comment c = new Comment();
        c.setRelTypeCode(normRelType(req.relTypeCode));
        c.setRelId(req.relId);
        c.setContent(req.content);
        c.setParentId(req.parentId);

        commentService.writeComment(c, memberId);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        return result;
    }

    // ✅ 기존: POST /api/comments/{relTypeCode}/{relId} body {content,parentId}
    @PostMapping("/{relTypeCode}/{relId}")
    public Map<String, Object> writeByPath(
            @PathVariable String relTypeCode,
            @PathVariable int relId,
            @RequestBody Comment comment,
            Authentication auth
    ) {
        Integer memberId = loginId(auth);
        if (memberId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");

        if (comment == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 요청입니다.");
        comment.setRelTypeCode(normRelType(relTypeCode));
        comment.setRelId(relId);

        commentService.writeComment(comment, memberId);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        return result;
    }

    @PutMapping("/{id}")
    public Map<String, Object> modify(
            @PathVariable int id,
            @RequestBody Comment comment,
            Authentication auth
    ) {
        Integer memberId = loginId(auth);
        if (memberId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");

        if (comment == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 요청입니다.");
        comment.setId(id);

        commentService.modifyComment(comment, memberId);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        return result;
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(
            @PathVariable int id,
            Authentication auth
    ) {
        Integer memberId = loginId(auth);
        if (memberId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");

        commentService.deleteComment(id, memberId);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        return result;
    }

    @Data
    static class WriteReq {
        private String relTypeCode;
        private Integer relId;
        private Integer parentId;
        private String content;
    }
}
