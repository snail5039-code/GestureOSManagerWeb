package com.example.demo.token;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.access-token.exp-minutes:60}")
    private int accessExpMinutes;

    @Value("${jwt.refresh-token.exp-days:7}")
    private int refreshExpDays;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    // ✅ Access Token (짧게)
    public String createAccessToken(Integer memberId, String loginId, String role) {
        Date now = new Date();
        Date exp = Date.from(Instant.now().plus(accessExpMinutes, ChronoUnit.MINUTES));

        return Jwts.builder()
                .subject(String.valueOf(memberId))
                .claim("loginId", loginId)
                .claim("role", role)
                .claim("typ", "access")
                .issuedAt(now)
                .expiration(exp)
                .signWith(key())
                .compact();
    }

    // ✅ Refresh Token (길게)
    public String createRefreshToken(Integer memberId) {
        Date now = new Date();
        Date exp = Date.from(Instant.now().plus(refreshExpDays, ChronoUnit.DAYS));

        return Jwts.builder()
                .subject(String.valueOf(memberId))
                .claim("typ", "refresh")
                .issuedAt(now)
                .expiration(exp)
                .signWith(key())
                .compact();
    }

    // ✅ 인증 필터에서는 Access Token만 허용
    public Authentication toAuthenticationFromAccessToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key())
                .build()
                .parseSignedClaims(token)
                .getPayload();

        String typ = claims.get("typ", String.class);
        if (!"access".equals(typ)) {
            throw new IllegalArgumentException("Not an access token");
        }

        Integer memberId = Integer.valueOf(claims.getSubject());
        String role = claims.get("role", String.class);

        return new UsernamePasswordAuthenticationToken(memberId, null, List.of(new SimpleGrantedAuthority(role)));
    }

    // ✅ Refresh Token에서 memberId 추출(재발급 API에서 사용)
    public Integer getMemberIdFromRefreshToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key())
                .build()
                .parseSignedClaims(token)
                .getPayload();

        String typ = claims.get("typ", String.class);
        if (!"refresh".equals(typ)) {
            throw new IllegalArgumentException("Not a refresh token");
        }
        return Integer.valueOf(claims.getSubject());
    }

}