package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

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
	
	@JsonProperty("frames_received")
	private Integer framesReceived;
	
	private String mode;
	private Integer streak;
	
	private KcisaItem kcisa;
}
