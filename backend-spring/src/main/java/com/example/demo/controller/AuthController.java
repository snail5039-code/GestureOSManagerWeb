package com.example.demo.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dao.RefreshTokenDao;
import com.example.demo.dto.Member;
import com.example.demo.service.MemberService;
import com.example.demo.token.JwtTokenProvider;
import com.example.demo.token.RefreshToken;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;

@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
@RestController
public class AuthController {

    private final RefreshTokenDao refreshTokenDao;
    private final JwtTokenProvider jwtTokenProvider;
    private final MemberService memberService;
    
    public AuthController(RefreshTokenDao refreshTokenDao, JwtTokenProvider jwtTokenProvider, MemberService memberService) {
        this.refreshTokenDao = refreshTokenDao;
        this.jwtTokenProvider = jwtTokenProvider;
        this.memberService = memberService;
    }

    @PostMapping("/api/auth/token")
    public Map<String, Object> issueAccessToken(@CookieValue(value = "refreshToken", required = false) String refreshToken) {
        // Refresh Token 유효성 확인
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No refresh token");
        }

        // 토큰 유효성 검사 및 memberId 추출
        Integer id;
        try {
            id = this.jwtTokenProvider.getMemberIdFromRefreshToken(refreshToken);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }

        // DB에서 저장된 Refresh Token 가져오기
        RefreshToken saved = this.refreshTokenDao.findByMemberId(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token not found"));
        
        // 저장된 Refresh Token과 일치하는지 확인
        if (!refreshToken.equals(saved.getToken())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token mismatch");
        }

        // 해당 member 조회
        Member m = this.memberService.findById(id);

        // Access Token 생성
        String accessToken = jwtTokenProvider.createAccessToken(m.getId(), m.getLoginId()); // 두 번째 선언은 제거

        return Map.of("accessToken", accessToken, "memberId", m.getId());
    }
    @PostMapping("/api/auth/logout")
    public void logout(
            @CookieValue(value = "refreshToken", required = false) String refreshToken,
            HttpServletResponse response
    ) {
        // 1. DB에서 refreshToken 제거
        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokenDao.deleteByToken(refreshToken);
        }

        // 2. 쿠키 삭제
        Cookie cookie = new Cookie("refreshToken", null);
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // 개발환경
        cookie.setPath("/");
        cookie.setMaxAge(0); // 즉시 만료
        response.addCookie(cookie);
    }
    
}
