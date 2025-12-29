package com.example.demo.controller;

import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.example.demo.dao.RefreshTokenDao;
import com.example.demo.dto.Member;
import com.example.demo.security.JwtTokenProvider;
import com.example.demo.service.MemberService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;

@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
@RestController
@RequestMapping("/api/members")
public class MemberController {

    private final MemberService memberService;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenDao refreshTokenDao;

    public MemberController(MemberService memberService, JwtTokenProvider jwtTokenProvider, RefreshTokenDao refreshTokenDao) {
        this.memberService = memberService;
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenDao = refreshTokenDao;
    }

    // 회원가입
    @PostMapping("/join")
    public Map<String, Object> join(@RequestBody Member member) {
        memberService.join(member);
        return Map.of("message", "회원가입 완료");
    }

    // 로그인
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body, HttpServletResponse response) {
        String loginId = body.get("loginId");
        String loginPw = body.get("loginPw");

        Member m = memberService.login(loginId, loginPw);

        // ✅ access token
        String accessToken = jwtTokenProvider.createAccessToken(m.getId(), m.getLoginId());

        // ✅ refresh token + DB 저장
        String refreshToken = jwtTokenProvider.createRefreshToken(m.getId());
        refreshTokenDao.upsert(m.getId(), refreshToken);

        // ✅ refresh token 쿠키 저장 (HttpOnly)
        Cookie cookie = new Cookie("refreshToken", refreshToken);
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // 운영 HTTPS면 true
        cookie.setPath("/");
        cookie.setMaxAge(60 * 60 * 24 * 7);
        response.addCookie(cookie);

        return Map.of("message", "로그인 성공", "accessToken", accessToken, "memberId", m.getId());
    }

    // 로그아웃 (일단 메시지만)
    @PostMapping("/logout")
    public Map<String, Object> logout() {
        return Map.of("message", "로그아웃");
    }

    @GetMapping("/me")
    public Map<String, Object> me(Authentication authentication) {
        if (authentication == null) return Map.of("logined", false);
        Integer memberId = (Integer) authentication.getPrincipal();
        return Map.of("logined", true, "memberId", memberId);
    }
}
