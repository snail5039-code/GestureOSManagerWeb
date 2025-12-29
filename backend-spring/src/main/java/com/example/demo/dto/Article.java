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
}
