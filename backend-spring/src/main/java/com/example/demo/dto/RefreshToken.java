package com.example.demo.dto;

import lombok.Data;

@Data
public class RefreshToken {
	private Integer memberId;
	private String token;
}
