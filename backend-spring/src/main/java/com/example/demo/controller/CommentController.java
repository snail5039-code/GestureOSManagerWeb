package com.example.demo.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dto.Comment;
import com.example.demo.service.CommentService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @GetMapping("/{relTypeCode}/{relId}")
    public List<Comment> list(
            @PathVariable String relTypeCode,
            @PathVariable int relId,
            Authentication auth) {

        Integer loginMemberId = (auth != null) ? (Integer) auth.getPrincipal() : null;
        return commentService.getCommentsByRel(relTypeCode, relId, loginMemberId);
    }

    @PostMapping("/{relTypeCode}/{relId}")
    public Map<String, Object> write(
            @PathVariable String relTypeCode,
            @PathVariable int relId,
            @RequestBody Comment comment,
            Authentication auth) {

        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        Integer loginMemberId = (Integer) auth.getPrincipal();
        comment.setRelTypeCode(relTypeCode);
        comment.setRelId(relId);

        commentService.writeComment(comment, loginMemberId);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        return result;
    }

    @PutMapping("/{id}")
    public Map<String, Object> modify(
            @PathVariable int id,
            @RequestBody Comment comment,
            Authentication auth) {

        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        Integer loginMemberId = (Integer) auth.getPrincipal();
        comment.setId(id);

        commentService.modifyComment(comment, loginMemberId);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        return result;
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(
            @PathVariable int id,
            Authentication auth) {

        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        Integer loginMemberId = (Integer) auth.getPrincipal();
        commentService.deleteComment(id, loginMemberId);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        return result;
    }
}
