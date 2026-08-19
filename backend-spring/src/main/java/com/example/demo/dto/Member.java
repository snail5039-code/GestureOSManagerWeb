package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

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

    /**
     * 요청으로 받기만 하고 응답에는 절대 싣지 않는다.
     * MemberDao 가 SELECT * 로 조회하므로 이 필드에는 bcrypt 해시가 담긴다.
     * WRITE_ONLY 가 없으면 /api/members/me, /api/members/mypage 응답에 해시가 그대로 나간다.
     * (MyBatis 매핑에는 영향이 없다 — Jackson 직렬화에만 적용된다)
     */
    @NotBlank(message = "비밀번호 필수")
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
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

    /** 소셜 제공자 내부 식별자. 클라이언트에 노출할 이유가 없다(계정 식별에 쓰이는 값). */
    @JsonIgnore
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
