package com.example.demo.controller;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.example.demo.dto.KcisaItem;
import com.example.demo.service.KcisaIngestService;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/kcisa")
@CrossOrigin(originPatterns = {"http://localhost:5173", "http://localhost:5174"})
public class KcisaIngestController {
	private final KcisaIngestService kcisaIngestService;
	
	private static final String BASE_URL = "https://api.kcisa.kr/openapi/service/rest/meta13/getCTE01701";
	
	private static final String SERVICE_KEY = "1099ca75-c757-450f-bb0f-3f7f4d90833f";
	
	private final RestTemplate restTemplate = new RestTemplate();
	
	
	@GetMapping("/raw")
	public String raw(@RequestParam(defaultValue = "1") int pageNo, @RequestParam(defaultValue = "5") int numOfRows, @RequestParam(required = false) String keyword) {
		UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(BASE_URL)
				.queryParam("serviceKey", SERVICE_KEY)
				.queryParam("pageNo", pageNo)
				.queryParam("numOfRows", numOfRows);
		
		if (keyword != null && !keyword.isBlank()) {
			builder.queryParam("keyword", keyword);
		}
		
		String url = builder.build().toUriString();
		return restTemplate.getForObject(url, String.class);
	}
	@GetMapping("/items")
	public List<KcisaItem> items(@RequestParam(defaultValue = "1") int pageNo,
	                             @RequestParam(defaultValue = "5") int numOfRows,
	                             @RequestParam(required = false) String keyword) {

	    return this.kcisaIngestService.items(pageNo, numOfRows, keyword);
	}
	
	@GetMapping("/search")
	public List<KcisaItem> search(@RequestParam String keyword, @RequestParam(defaultValue = "5") int limit) {
		
		return this.kcisaIngestService.search(keyword, limit);
	}
	
	@GetMapping("/best")
	public Object  best(@RequestParam String title) {
		KcisaItem best = this.kcisaIngestService.findBest(title);
	    return best;
	}
}
