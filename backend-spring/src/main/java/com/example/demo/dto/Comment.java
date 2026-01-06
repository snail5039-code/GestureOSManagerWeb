package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Comment {
    private Integer id;
    private String relTypeCode;
    private Integer relId;
    private Integer memberId;
    private String content;
    private Integer parentId;
    private String regDate;
    private String updateDate;

    // 조회 시 추가 정보
    private String writerName;
    private Boolean canModify;
    private Boolean canDelete;
    private Integer replyCount;
    private Integer likeCount;
    private Boolean isLiked;
}
