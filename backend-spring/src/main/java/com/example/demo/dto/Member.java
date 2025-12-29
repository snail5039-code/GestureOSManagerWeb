package com.example.demo.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Member {

	private Integer id;
	@NotBlank(message = "아이디 필수")
	private String loginId;

	@NotBlank(message = "비밀번호 필수")
	private String loginPw;
	private String regDate;
	private String updateDate;
	@NotBlank(message = "이름 필수")
	private String name;

	@NotBlank(message = "이메일 필수")
	@Email(message = "이메일 형식이 아님")
	private String email;

	@NotNull(message = "국적 선택 필수")
	  private Integer countryId;
	private String provider;
	private String providerKey;
	
}
