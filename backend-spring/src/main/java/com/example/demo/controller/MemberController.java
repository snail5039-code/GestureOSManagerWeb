package com.example.demo.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dto.Member;
import com.example.demo.info.GoogleUserInfo;
import com.example.demo.info.KakaoUserInfo;
import com.example.demo.info.NaverUserInfo;
import com.example.demo.dao.RefreshTokenDao;
import com.example.demo.dto.Country;
import com.example.demo.service.MemberService;
import com.example.demo.social.OAuth2UserInfo;
import com.example.demo.token.JwtTokenProvider;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Map;
import java.util.List;

@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
@RestController
@RequestMapping("/api/members") // 모든 요청은 /api/members로 시작
public class MemberController {

    private final MemberService memberService;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenDao refreshTokenDao;

    public MemberController(MemberService memberService, JwtTokenProvider jwtTokenProvider, RefreshTokenDao refreshTokenDao) {
        this.memberService = memberService;
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenDao = refreshTokenDao;
    }

    // 1. 국적 목록 (회원가입 페이지용)
    @GetMapping("/countries")
    public List<Country> getCountries() {
        return memberService.countries();
    }

    // 2. 일반 회원가입
    @PostMapping("/join")
    public Map<String, Object> join(@RequestBody Member member) {
        this.memberService.join(member);
        return Map.of("message", "회원가입 완료");
    }

    // 3. 일반 로그인
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body, HttpServletResponse response) {
        String loginId = body.getOrDefault("loginId", "");
        String loginPw = body.getOrDefault("loginPw", "");

        if (loginId.isBlank() || loginPw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "아이디와 비밀번호를 입력해주세요.");
        }

        Member member = memberService.login(loginId, loginPw);
        System.out.println(loginId);
        System.out.println(loginPw);
        return generateTokens(member, response);
    }

    // 4. 소셜 로그인 후처리 (Security SuccessHandler에서 넘어오는 로직 대비)
    // 이 메서드는 프론트에서 소셜 로그인 성공 후 유저 정보를 다시 확인할 때 사용 가능합니다.
    @GetMapping("/oauth2/login")
    public Map<String, Object> oauthLogin(@AuthenticationPrincipal OAuth2User principal, 
                                          @RequestParam("provider") String provider,
                                          HttpServletResponse response) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);

        Map<String, Object> attributes = principal.getAttributes();
        OAuth2UserInfo info = switch (provider.toLowerCase()) {
            case "google" -> new GoogleUserInfo(attributes);
            case "kakao" -> new KakaoUserInfo(attributes);
            case "naver" -> new NaverUserInfo((Map<String, Object>) attributes.get("response"));
            default -> throw new IllegalArgumentException("Unsupported provider");
        };

        Member m = memberService.upsertSocialUser(
                provider.toUpperCase(),
                info.getEmail(),
                info.getName(),
                info.getProviderKey()
        );

        System.out.println(provider);
        System.out.println(principal);
        return generateTokens(m, response);
    }

    // 5. 현재 로그인된 유저 정보 확인 (AuthProvider 로딩 시 필수)
    @GetMapping("/me")
    public Map<String, Object> getCurrentMember(@AuthenticationPrincipal Object principal) {
        if (principal == null || principal.toString().equals("anonymousUser")) {
            return Map.of("logined", false);
        }
        // principal이 OAuth2User인지 일반 유저인지에 따라 적절한 데이터 반환
        return Map.of("logined", true, "user", principal);
    }

    // 6. 로그아웃 (쿠키 삭제)
    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("refreshToken", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
        return Map.of("message", "로그아웃 완료");
    }

    // [공통 로직] 토큰 생성 및 리프레시 토큰 쿠키 저장
    private Map<String, Object> generateTokens(Member member, HttpServletResponse response) {
        String accessToken = jwtTokenProvider.createAccessToken(member.getId(), member.getEmail());
        String refreshToken = jwtTokenProvider.createRefreshToken(member.getId());

        // DB에 리프레시 토큰 저장
        refreshTokenDao.upsert(member.getId(), refreshToken);

        // 쿠키 설정
        Cookie cookie = new Cookie("refreshToken", refreshToken);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(60 * 60 * 24 * 7); // 7일
        response.addCookie(cookie);

        return Map.of(
            "accessToken", accessToken, 
            "memberId", member.getId(), 
            "name", member.getName()
        );
    }
}