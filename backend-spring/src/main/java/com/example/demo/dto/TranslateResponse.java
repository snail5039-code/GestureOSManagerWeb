package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TranslateResponse {
	private String label;
	private String text;
	private double confidence;
	private Integer framesReceived;
	
	private String mode;
	private Integer streak;
}
