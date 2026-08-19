package com.example.demo.controller;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.dto.KcisaItem;
import com.example.demo.service.KcisaIngestService;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/kcisa")
@CrossOrigin(originPatterns = {"http://localhost:5173", "http://localhost:5174"})
public class KcisaIngestController {
	private final KcisaIngestService kcisaIngestService;

	// 주소와 인증키는 서비스가 설정에서 읽는다. 컨트롤러에 키를 두면 안 된다.
	@GetMapping("/raw")
	public String raw(@RequestParam(defaultValue = "1") int pageNo, @RequestParam(defaultValue = "5") int numOfRows, @RequestParam(required = false) String keyword) {
		return this.kcisaIngestService.rawJson(pageNo, numOfRows, keyword);
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
