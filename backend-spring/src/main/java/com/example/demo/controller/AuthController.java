package com.example.demo.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dao.RefreshTokenDao;
import com.example.demo.dto.Member;
import com.example.demo.service.AuthBridgeService;
import com.example.demo.service.MemberService;
import com.example.demo.token.JwtTokenProvider;
import com.example.demo.token.RefreshToken;

import jakarta.servlet.http.HttpServletResponse;

@CrossOrigin(originPatterns = "*", allowCredentials = "true")
@RestController
public class AuthController {

    private final RefreshTokenDao refreshTokenDao;
    private final JwtTokenProvider jwtTokenProvider;
    private final MemberService memberService;
    private final AuthBridgeService authBridgeService;

    public AuthController(
            RefreshTokenDao refreshTokenDao,
            JwtTokenProvider jwtTokenProvider,
            MemberService memberService,
            AuthBridgeService authBridgeService) {
        this.refreshTokenDao = refreshTokenDao;
        this.jwtTokenProvider = jwtTokenProvider;
        this.memberService = memberService;
        this.authBridgeService = authBridgeService;
    }

    // refreshToken 쿠키로 accessToken 재발급
    @PostMapping("/api/auth/token")
    public Map<String, Object> issueAccessToken(
            @CookieValue(value = "refreshToken", required = false) String refreshToken) {

        if (refreshToken == null || refreshToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No refresh token");
        }

        Integer id;
        try {
            id = this.jwtTokenProvider.getMemberIdFromRefreshToken(refreshToken);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }

        RefreshToken saved = this.refreshTokenDao.findByMemberId(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token not found"));

        if (!refreshToken.equals(saved.getToken())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token mismatch");
        }

        Member m = this.memberService.findById(id);

        String role = m.getRole();
        if (role != null && !role.startsWith("ROLE_")) role = "ROLE_" + role;

        String accessToken = jwtTokenProvider.createAccessToken(m.getId(), m.getLoginId(), role);
        return Map.of("accessToken", accessToken, "memberId", m.getId());
    }

    @PostMapping("/api/auth/logout")
    public void logout(
            @CookieValue(value = "refreshToken", required = false) String refreshToken,
            HttpServletResponse response) {

        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokenDao.deleteByToken(refreshToken);
        }

        // 쿠키 제거
        clearRefreshCookie(response);
    }

    // 1) 매니저(로그인된 상태)에서 1회용 code 발급 (Authorization: Bearer <accessToken>)
    @PostMapping("/api/auth/bridge/start")
    public Map<String, Object> bridgeStart(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String accessToken = extractBearer(authHeader);
        if (accessToken == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No access token");
        }

        try {
            Authentication auth = jwtTokenProvider.toAuthenticationFromAccessToken(accessToken);
            Integer memberId = (Integer) auth.getPrincipal();

            String code = authBridgeService.createCode(memberId);
            return Map.of("code", code, "expiresInSec", authBridgeService.getTtlSeconds());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid access token");
        }
    }

    // 2) code 소비 -> 서버가 refreshToken 쿠키 세팅 + accessToken 발급
    @PostMapping("/api/auth/bridge/consume")
    public Map<String, Object> bridgeConsume(
            @RequestBody Map<String, String> body,
            HttpServletResponse response) {

        String code = body.get("code");
        Integer memberId = authBridgeService.consume(code);

        RefreshToken saved = refreshTokenDao.findByMemberId(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token not found"));

        setRefreshCookie(response, saved.getToken());

        Member m = memberService.findById(memberId);

        String roleForJwt = m.getRole();
        if (roleForJwt != null && !roleForJwt.startsWith("ROLE_")) roleForJwt = "ROLE_" + roleForJwt;

        String accessToken = jwtTokenProvider.createAccessToken(m.getId(), m.getLoginId(), roleForJwt);

        return Map.of(
                "accessToken", accessToken,
                "memberId", m.getId(),
                "role", m.getRole(),
                "name", m.getName());
    }

    // (옵션) 백엔드에서 바로 쿠키 세팅 후 "/"로 리다이렉트 (필요하면 사용)
    @GetMapping("/bridge")
    public void bridgeRedirect(
            @RequestParam(value = "code", required = false) String code,
            HttpServletResponse response) {

        if (code == null || code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "code is required");
        }

        Integer memberId = authBridgeService.consume(code);

        RefreshToken saved = refreshTokenDao.findByMemberId(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token not found"));

        setRefreshCookie(response, saved.getToken());

        try {
            response.sendRedirect("/");
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "redirect failed");
        }
    }

    private static void setRefreshCookie(HttpServletResponse response, String refreshToken) {
        // 로컬 개발에선 SameSite=Lax + withCredentials + proxy 구성이 제일 안정적
        String cookie = "refreshToken=" + refreshToken
                + "; Path=/"
                + "; HttpOnly"
                + "; Max-Age=" + (60 * 60 * 24 * 7)
                + "; SameSite=Lax";
        response.addHeader("Set-Cookie", cookie);
    }

    private static void clearRefreshCookie(HttpServletResponse response) {
        String cookie = "refreshToken=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax";
        response.addHeader("Set-Cookie", cookie);
    }

    private static String extractBearer(String authHeader) {
        if (authHeader == null) return null;
        String h = authHeader.trim();
        if (h.regionMatches(true, 0, "Bearer ", 0, 7)) return h.substring(7).trim();
        return null;
    }
}
