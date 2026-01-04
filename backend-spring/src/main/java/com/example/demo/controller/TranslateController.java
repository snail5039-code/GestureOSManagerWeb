package com.example.demo.controller;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;

import com.example.demo.dto.KcisaItem;
import com.example.demo.dto.TranslateResponse;
import com.example.demo.dto.TranslationLog;
import com.example.demo.service.KcisaIngestService;
import com.example.demo.service.TranslateResponseService;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
@CrossOrigin(originPatterns = { "http://localhost:5173", "http://localhost:5174" })
public class TranslateController {

	// ✅ 파이썬 연결
	private final WebClient webClient = WebClient.create("http://127.0.0.1:8000");

	private final TranslateResponseService translateResponseService;
	private final KcisaIngestService kcisaIngestService;

	// ✅ RAW 파싱용
	private final ObjectMapper om = new ObjectMapper();

	@PostMapping("/api/translate")
	public TranslateResponse translate(@RequestBody Map<String, Object> body) {

		// ✅ status + raw를 무조건 찍고, 절대 null return 금지
		TranslateResponse res = webClient.post().uri("/predict").contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.APPLICATION_JSON).bodyValue(body)
				.exchangeToMono((ClientResponse resp) -> resp.bodyToMono(String.class).defaultIfEmpty("").map(raw -> {
					System.out.println("[PY] status = " + resp.statusCode());
					System.out.println("[PY] raw    = " + raw);

					// 2xx 아니면 errorResponse
					if (!resp.statusCode().is2xxSuccessful()) {
						return errorResponse();
					}

					// raw -> DTO
					try {
						return om.readValue(raw, TranslateResponse.class);
					} catch (Exception e) {
						e.printStackTrace();
						return errorResponse();
					}
				})).timeout(Duration.ofSeconds(15)).onErrorResume(e -> {
					System.out.println("[PY] call failed = " + e);
					e.printStackTrace();
					return Mono.just(errorResponse());
				}).block();

		if (res == null)
			res = errorResponse();

		// ✅ null 안전 처리(여기서부터 아래 로직 절대 안 터짐)
		if (res.getFramesReceived() == null)
			res.setFramesReceived(0);
		if (res.getStreak() == null)
			res.setStreak(0);
		if (res.getMode() == null)
			res.setMode("idle");
		if (res.getLabel() == null)
			res.setLabel("");
		if (res.getText() == null)
			res.setText("");

		double conf = Math.max(0.0, Math.min(1.0, res.getConfidence()));
		res.setConfidence(conf);

		boolean isFinal = "final".equalsIgnoreCase(res.getMode());
		boolean hasText = res.getText() != null && !res.getText().isBlank();

		// ✅ unknown 조건(빈문자 포함)
		boolean unknown = (res.getLabel() == null || res.getLabel().isBlank())
				|| (res.getText() == null || res.getText().isBlank()) || (res.getConfidence() < 0.6)
				|| "번역 실패".equals(res.getText());

		// ✅ final인데 이상하면 KCISA 후보 탐색(원하면 유지)
		if (isFinal && hasText && unknown) {
			try {
				KcisaItem best = this.kcisaIngestService.findBest(res.getText());
				System.out.println("KCISA BEST = " + best);
				// res.setKcisa(best); // kcisa 내려줄 거면 DTO에 맞춰서 사용
			} catch (Exception e) {
				e.printStackTrace();
			}
		}

		// ✅ final이고 텍스트 있으면 저장
		if (isFinal && hasText) {
			this.translateResponseService.save(res.getText(), res.getConfidence());
		}

		System.out.println("[SPRING] FINAL RES = " + res);
		return res;
	}

	// ✅ DB 로그 조회
	@GetMapping("/api/translation-log")
	public List<TranslationLog> recent(@RequestParam(defaultValue = "10") int limit) {
		if (limit < 1)
			limit = 1;
		if (limit > 100)
			limit = 100;
		return translateResponseService.findRecent(limit);
	}

	private TranslateResponse errorResponse() {
		TranslateResponse r = new TranslateResponse();
		r.setLabel(""); // ✅ null 말고 빈 문자열
		r.setText(""); // ✅ null 말고 빈 문자열
		r.setConfidence(0.0);
		r.setFramesReceived(0);
		r.setMode("error");
		r.setStreak(0);
		r.setKcisa(null);
		return r;
	}
}
