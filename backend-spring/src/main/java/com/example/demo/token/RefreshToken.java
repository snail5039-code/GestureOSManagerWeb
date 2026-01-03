package com.example.demo.token;

import lombok.Data;

@Data
public class RefreshToken {
	private Integer memberId;
	private String token;
}
