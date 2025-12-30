package com.example.demo.controller;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import com.example.demo.dto.KcisaItem;
import com.example.demo.dto.TranslateResponse;
import com.example.demo.dto.TranslationLog;
import com.example.demo.service.KcisaIngestService;
import com.example.demo.service.TranslateResponseService;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@CrossOrigin(originPatterns = {"http://localhost:5173", "http://localhost:5174"})
public class TranslateController {
	//파이썬 연결
	private final WebClient webClient = WebClient.create("http://127.0.0.1:8000");
	private final TranslateResponseService translateResponseService;
	private final KcisaIngestService kcisaIngestService;
	
    @PostMapping("/api/translate")
    public TranslateResponse translate(@RequestBody Map<String, Object> body) {
    	
		TranslateResponse res = webClient.post()
    				.uri("/predict")
    				.bodyValue(body)
    				.retrieve()
    				.bodyToMono(TranslateResponse.class)
    				.timeout(Duration.ofSeconds(3))
    				.onErrorResume(e -> {
    				    e.printStackTrace(); // ✅ 원인 콘솔에 출력
    				    return reactor.core.publisher.Mono.just(
    				    		errorResponse()
    				    );
    				})
    				.block();
    		
    		if(res == null) {
    			res = errorResponse();
    		}
    		
    		if (res.getFramesReceived() == null) res.setFramesReceived(0);
    	    if (res.getStreak() == null) res.setStreak(0);

    	    double conf = Math.max(0.0, Math.min(1.0, res.getConfidence()));
    	    res.setConfidence(conf);
    		
    	    boolean isFinal = "final".equalsIgnoreCase(res.getMode());
    	    boolean hasText = res.getText() != null && !res.getText().isBlank();
    	    boolean unknown = (res.getLabel() == null) || (res.getConfidence() < 0.6) || "번역 실패".equals(res.getText());

    	    if (isFinal && hasText && unknown) {
    	        try {
    	            // best 찾기 (일단 콘솔로 확인)
    	            KcisaItem best = this.kcisaIngestService.findBest(res.getText());
    	            System.out.println("KCISA BEST = " + best);

    	            // 나중에 DTO에 kcisa 필드 추가하면 이걸로 바꾸면 됨:
    	            // res.setKcisa(best);

    	        } catch (Exception e) {
    	            e.printStackTrace();
    	        }
    	    }
    	    
    	    
            if ("final".equalsIgnoreCase(res.getMode()) && res.getText() != null && !res.getText().isBlank()) {
                this.translateResponseService.save(res.getText(), res.getConfidence());
            }
            
            System.out.println(res);
    	return res;
    }
    
    //디비 조회하기 귀찮으니 만드는 거
    @GetMapping("api/translation-log")
    public List<TranslationLog> recent(@RequestParam(defaultValue = "10") int limit) {
    	if(limit < 1) limit = 1;
    	if(limit > 100) limit = 100;
    	
    	return translateResponseService.findRecent(limit);
    }
    
    private TranslateResponse errorResponse() {
        TranslateResponse r = new TranslateResponse(); // 기본 생성자
        r.setLabel(null);
        r.setText(null);
        r.setConfidence(0.0);
        r.setFramesReceived(0);
        r.setMode("error");
        r.setStreak(0);
        r.setKcisa(null); // 새로 추가한 필드
        return r;
    }
}
