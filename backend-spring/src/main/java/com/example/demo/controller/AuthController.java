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
import com.example.demo.dto.RefreshToken;
import com.example.demo.security.JwtTokenProvider;
import com.example.demo.service.MemberService;

@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
@RestController
public class AuthController {

	private RefreshTokenDao refreshTokenDao;
	private JwtTokenProvider jwtTokenProvider;
	private MemberService memberService;
	
	public AuthController(RefreshTokenDao refreshTokenDao, JwtTokenProvider jwtTokenProvider, MemberService memberService) {
		this.refreshTokenDao = refreshTokenDao;
		this.jwtTokenProvider = jwtTokenProvider;
		this.memberService = memberService;
	}
	
	@PostMapping("/api/auth/token")
	public Map<String, Object> issueAccessToken(@CookieValue(value = "refreshToken", required = false) String refreshToken) {
		
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
		
        String accessToken = jwtTokenProvider.createAccessToken(m.getId(), m.getLoginId());
		
		
		return Map.of("accessToken", accessToken, "memberId", m.getId());
		
	}
}
