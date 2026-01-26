package com.example.demo.social;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleValid(MethodArgumentNotValidException e) {

		String msg = e.getBindingResult().getFieldErrors().isEmpty()
				? "요청 오류"
				: e.getBindingResult().getFieldErrors().get(0).getDefaultMessage();

		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
				"code", "VALIDATION_ERROR",
				"message", msg
		));
	}

	/**
	 * ✅ 업로드 용량 초과(3MB) 등 multipart 파싱 단계에서 터지는 예외 처리
	 * - Spring이 request body 파싱하다가 먼저 터지면 Controller까지 못 옴
	 * - 그래서 여기서 413 + FILE_TOO_LARGE 로 내려줘야 프론트가 구분 가능
	 */
	@ExceptionHandler({ MaxUploadSizeExceededException.class, MultipartException.class })
	public ResponseEntity<Map<String, Object>> handleUploadTooLarge(Exception e) {
		return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of(
				"code", "FILE_TOO_LARGE",
				"message", "3MB 이하로 업로드해 주세요."
		));
	}

	/**
	 * ✅ 네가 곳곳에서 던지는 ResponseStatusException 메시지 통일해서 JSON으로 내려줌
	 */
	@ExceptionHandler(ResponseStatusException.class)
	public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
		HttpStatus status = HttpStatus.resolve(e.getStatusCode().value());
		if (status == null) status = HttpStatus.BAD_REQUEST;

		String msg = (e.getReason() == null || e.getReason().isBlank())
				? "요청 오류"
				: e.getReason();

		// 413이면 프론트에서 바로 "용량 초과"로 처리 가능
		String code = (status == HttpStatus.PAYLOAD_TOO_LARGE) ? "FILE_TOO_LARGE" : "REQUEST_ERROR";

		return ResponseEntity.status(status).body(Map.of(
				"code", code,
				"message", msg
		));
	}

	/**
	 * ✅ 최종 fallback: 진짜 모르는 예외는 COMMON_500
	 */
	@ExceptionHandler(Exception.class)
	public ResponseEntity<Map<String, Object>> handleAny(Exception e) {
		e.printStackTrace();
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
				"code", "COMMON_500",
				"message", "서버 오류가 발생했습니다."
		));
	}
}
