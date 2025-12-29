package com.example.demo.security;

import java.io.IOException;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.example.demo.dto.Member;
import com.example.demo.dao.RefreshTokenDao;
import com.example.demo.security.GoogleUserInfo;
import com.example.demo.security.KakaoUserInfo;
import com.example.demo.security.NaverUserInfo;
import com.example.demo.security.OAuth2UserInfo;
import com.example.demo.service.MemberService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private final MemberService memberService;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenDao refreshTokenDao;

    @Value("${app.frontend-redirect-uri}")
    private String frontendRedirectUri;

    public OAuth2SuccessHandler(MemberService memberService,
                               JwtTokenProvider jwtTokenProvider,
                               RefreshTokenDao refreshTokenDao) {
        this.memberService = memberService;
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenDao = refreshTokenDao;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException {

        OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
        String provider = token.getAuthorizedClientRegistrationId(); // google/kakao/naver
        OAuth2User principal = (OAuth2User) token.getPrincipal();

        OAuth2UserInfo info = toUserInfo(provider, principal.getAttributes());

        // 서비스 방식 그대로 사용
        Member m = memberService.upsertSocialUser(
                provider.toUpperCase(),
                info.getEmail(),
                info.getName(),
                info.getProviderKey()
        );

        String refreshToken = jwtTokenProvider.createRefreshToken(m.getId());
        this.refreshTokenDao.upsert(m.getId(), refreshToken);

        Cookie cookie = new Cookie("refreshToken", refreshToken);
        cookie.setHttpOnly(true);
        cookie.setSecure(false);   // 운영 HTTPS면 true
        cookie.setPath("/");
        cookie.setMaxAge(60 * 60 * 24 * 7); //
        response.addCookie(cookie);

        // ✅ 토큰은 URL에 절대 싣지 않음
        response.sendRedirect(frontendRedirectUri);
    }

    @SuppressWarnings("unchecked")
    private OAuth2UserInfo toUserInfo(String provider, Map<String, Object> attributes) {
        return switch (provider) {
            case "google" -> new GoogleUserInfo(attributes);
            case "kakao" -> new KakaoUserInfo(attributes);
            case "naver" -> {
                Object resp = attributes.get("response");
                if (resp instanceof Map map) yield new NaverUserInfo((Map<String, Object>) map);
                throw new IllegalArgumentException("Invalid naver response");
            }
            default -> throw new IllegalArgumentException("Unsupported provider: " + provider);
        };
    }
}
