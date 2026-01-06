package com.example.demo.social;

import java.io.IOException;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.example.demo.dao.RefreshTokenDao;
import com.example.demo.dto.Member;
import com.example.demo.info.GoogleUserInfo;
import com.example.demo.info.KakaoUserInfo;
import com.example.demo.info.NaverUserInfo;
import com.example.demo.service.MemberService;
import com.example.demo.token.JwtTokenProvider;

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
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication)
            throws IOException {
        OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
        String provider = token.getAuthorizedClientRegistrationId();
        OAuth2User principal = (OAuth2User) token.getPrincipal();

        OAuth2UserInfo info = toUserInfo(provider, principal.getAttributes());

        // 서비스 방식 그대로 사용 (이미 만드신 로직)
        Member m = memberService.upsertSocialUser(
                provider.toUpperCase(),
                info.getEmail(),
                info.getName(),
                info.getProviderKey());

        // 1. 리프레시 토큰 처리 (쿠키)
        String refreshToken = jwtTokenProvider.createRefreshToken(m.getId());
        this.refreshTokenDao.upsert(m.getId(), refreshToken);

        Cookie cookie = new Cookie("refreshToken", refreshToken);
        cookie.setHttpOnly(true);
        cookie.setSecure(false);
        cookie.setPath("/");
        cookie.setMaxAge(60 * 60 * 24 * 7);
        response.addCookie(cookie);

        // 2. 액세스 토큰 생성
        String role = m.getRole();
        if (role != null && !role.startsWith("ROLE_")) {
            role = "ROLE_" + role;
        }
        String accessToken = jwtTokenProvider.createAccessToken(m.getId(), info.getEmail(), role);

        // 3. 프론트엔드로 리다이렉트 할 때 액세스 토큰을 쿼리 스트링으로 전달
        String redirectUrl = frontendRedirectUri + "?accessToken=" + accessToken + "&memberId=" + m.getId();

        // 리디렉션을 보내기 전에 주소가 제대로 세팅되었는지 확인
        System.out.println("Redirect URL: " + redirectUrl);

        response.sendRedirect(redirectUrl); // 리디렉션 URL로 이동
    }

    @SuppressWarnings("unchecked")
    private OAuth2UserInfo toUserInfo(String provider, Map<String, Object> attributes) {
        return switch (provider) {
            case "google" -> new GoogleUserInfo(attributes);
            case "kakao" -> new KakaoUserInfo(attributes);
            case "naver" -> {
                Object resp = attributes.get("response");
                if (resp instanceof Map map)
                    yield new NaverUserInfo((Map<String, Object>) map);
                throw new IllegalArgumentException("Invalid naver response");
            }
            default -> throw new IllegalArgumentException("Unsupported provider: " + provider);
        };
    }
}
