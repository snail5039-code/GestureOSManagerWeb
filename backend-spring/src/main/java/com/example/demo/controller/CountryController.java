package com.example.demo.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dto.Country;
import com.example.demo.service.MemberService;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
public class CountryController {

    private final MemberService memberService;

    public CountryController(MemberService memberService) {
        this.memberService = memberService;
    }

    @GetMapping("/countries")
    public List<Country> countries() {
        // 국가 목록을 조회하고 반환
        List<Country> countries = this.memberService.countries();
        
        // 국가 목록이 없으면 404 응답
        if (countries == null || countries.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No countries found");
        }

        return countries;
    }
}
