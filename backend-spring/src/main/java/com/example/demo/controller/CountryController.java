package com.example.demo.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.dao.CountryDao;
import com.example.demo.dto.Country;

@RestController
@RequestMapping("/api")
public class CountryController {

    private final CountryDao countryDao;

    public CountryController(CountryDao countryDao) {
        this.countryDao = countryDao;
    }

    @GetMapping("/countries")
    public List<Country> countries() {
        return countryDao.findAll();
    }
}
