package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Article {
	private Integer id;
	private String title;
	private String content;
	private String regDate;
	private String updateDate;
	private Integer boardId;
	private Integer memberId;
	private String writerName;

	// ✅ 고정 관련
	private Boolean isPinned;
	private Integer pinnedOrder;
	private String lang;

	// ✅ 추가: 작성자 프로필 이미지 URL(또는 경로)
	private String writerProfileImageUrl;

	private Integer hit;
	private Integer commentCount;
	private Boolean canModify;
	private Boolean canDelete;
	private Integer likeCount;
	private Boolean isLiked;
}