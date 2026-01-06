package com.example.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.dao.ReactionDao;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ReactionService {

    private final ReactionDao reactionDao;

    @Transactional
    public boolean toggleReaction(String relTypeCode, int relId, int memberId) {
        if (reactionDao.hasReacted(relTypeCode, relId, memberId)) {
            reactionDao.deleteReaction(relTypeCode, relId, memberId);
            return false; // 좋아요 취소됨
        } else {
            reactionDao.insertReaction(relTypeCode, relId, memberId);
            return true; // 좋아요 추가됨
        }
    }

    public int getReactionCount(String relTypeCode, int relId) {
        return reactionDao.getReactionCount(relTypeCode, relId);
    }

    public boolean hasReacted(String relTypeCode, int relId, int memberId) {
        return reactionDao.hasReacted(relTypeCode, relId, memberId);
    }
}
