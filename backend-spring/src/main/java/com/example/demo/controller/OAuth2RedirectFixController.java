package com.example.demo.controller;

import java.io.IOException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
public class OAuth2RedirectFixController {

    @GetMapping("/oauth2/success")
    public void success(HttpServletRequest req, HttpServletResponse res) throws IOException {
        // 요청에서 쿼리 스트링을 추출 (accessToken=...)
        String q = req.getQueryString(); 
        // 리디렉션할 URL 설정 (쿼리 스트링을 추가하여 전달)
        String url = "http://localhost:5173/oauth2/success" + (q != null ? "?" + q : "");
        res.sendRedirect(url); // 리디렉션 처리
    }
}


