package com.example.demo.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.service.ReactionService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/reactions")
@RequiredArgsConstructor
public class ReactionController {

    private final ReactionService reactionService;

    @PostMapping("/{relTypeCode}/{relId}")
    public Map<String, Object> toggleReaction(
            @PathVariable String relTypeCode,
            @PathVariable int relId,
            Authentication auth) {

        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        Integer memberId = (Integer) auth.getPrincipal();
        boolean isLiked = reactionService.toggleReaction(relTypeCode, relId, memberId);
        int likeCount = reactionService.getReactionCount(relTypeCode, relId);

        Map<String, Object> result = new HashMap<>();
        result.put("isLiked", isLiked);
        result.put("likeCount", likeCount);

        return result;
    }
}
