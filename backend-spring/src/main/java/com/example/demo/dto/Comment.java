package com.example.demo.dto;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Comment {
    private Integer id;
    private String relTypeCode;
    private Integer relId;
    private Integer memberId;
    private String content;
    private Integer parentId;
    private String regDate;
    private String updateDate;

    // 작성자 표시용 (프론트에서 writerNickname 우선 사용)
    private String writerNickname;

    // optional (없어도 프론트가 defaultAvatar로 처리 가능)
    private String writerProfileImageUrl;
    private String writerLoginId;

    // ✅ 프론트에서 기대하는 이름: canEdit/canDelete
    private Boolean canEdit;
    private Boolean canDelete;

    // 부가정보
    private Integer replyCount;
    private Integer likeCount;
    private Boolean isLiked;

    // 트리 렌더링용(프론트에서도 트리 만들지만, 혹시 내려줘도 무시해도 됨)
    private List<Comment> children = new ArrayList<>();

    // 🔁 하위호환: 예전 프론트가 canModify를 본 적이 있으면 같이 내려줌
    @JsonProperty("canModify")
    public Boolean getCanModify() {
        return canEdit;
    }
}
