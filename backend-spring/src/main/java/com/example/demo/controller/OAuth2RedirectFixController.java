package com.example.demo.controller;

import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
public class OAuth2RedirectFixController {

    @Value("${app.frontend-redirect-uri:http://localhost:5174/oauth2/success}")
    private String frontendRedirectUri;

    @GetMapping("/oauth2/success")
    public void success(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String q = req.getQueryString();
        String url = frontendRedirectUri + (q != null ? "?" + q : "");
        res.sendRedirect(url);
    }
}
