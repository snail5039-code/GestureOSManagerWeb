package com.example.demo.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;
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
        return memberService.countries();
    }
}
