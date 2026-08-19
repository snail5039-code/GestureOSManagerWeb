package com.example.demo.config;

import java.io.IOException;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * /uploads/** 로 서빙되는 사용자 업로드 파일이 브라우저에서 "실행"되지 않게 막는다.
 *
 * <p>업로드 시점에 확장자를 검사하지만(=새로 올라오는 파일은 이미지뿐), 이 검사가 없던 시절에
 * 저장된 .html / .svg 파일이 남아 있을 수 있다. 그 파일들이 백엔드 오리진에서 렌더되면
 * 저장형 XSS 가 되므로 응답 단계에서도 한 번 더 막는다.
 *
 * <p>Content-Disposition: attachment 는 주소창으로 직접 열 때만 다운로드로 바꾼다.
 * &lt;img src&gt; 같은 하위 리소스 로딩에는 영향이 없으므로 프로필 사진은 그대로 표시된다.
 */
@Component
public class UploadedFileSecurityFilter extends OncePerRequestFilter {

    private static final String UPLOAD_PREFIX = "/uploads/";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Disposition", "attachment");
        res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; sandbox");

        chain.doFilter(req, res);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri == null || !uri.startsWith(UPLOAD_PREFIX);
    }
}
