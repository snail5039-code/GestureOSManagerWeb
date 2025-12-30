package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class KcisaItem {
	private String title;
	private String videoUrl;
	private String thumbUrl;
	private String detailUrl;
}
