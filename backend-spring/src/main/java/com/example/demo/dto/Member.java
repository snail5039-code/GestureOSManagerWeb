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

    private String role;

    private String nickname;
    private String nicknameUpdatedAt;

    private String profileImageUrl;

    /**
     * ✅ 프로필 이미지 리셋 플래그
     * - null: 프론트에서 안 보낸 경우(기본 false로 취급)
     * - true: 프로필 이미지 제거
     * - false: 유지
     *
     * Lombok(@Data)이 getResetProfileImage()/setResetProfileImage(Boolean) 자동 생성.
     * ❌ 직접 isResetProfileImage() 같은 메서드 만들면 MyBatis가 ambiguous getter로 터질 수 있음.
     */
    private Boolean resetProfileImage;
}
