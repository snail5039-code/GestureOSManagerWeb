package com.example.demo.security;

import java.io.IOException;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {
	
	private JwtTokenProvider jwtTokenProvider;
	
	public JwtAuthFilter(JwtTokenProvider jwtTokenProvider) {
		this.jwtTokenProvider = jwtTokenProvider;
	}
	
	@Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                var auth = jwtTokenProvider.toAuthenticationFromAccessToken(token);
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                // 토큰이 이상하면 그냥 인증 없이 통과(보호 API에서 401 뜸)
            }
        }
        chain.doFilter(req, res);
    }
}
