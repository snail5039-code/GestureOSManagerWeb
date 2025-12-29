package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Member {

	private Integer id;
	private String loginId;
	private String loginPw;
	private String regDate;
	private String updateDate;
	private String name;
	private String email;
	private Integer countryId;
	private String provider;
	private String providerKey;
	
}
