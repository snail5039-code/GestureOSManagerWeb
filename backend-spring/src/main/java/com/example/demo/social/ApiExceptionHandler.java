package com.example.demo.social;

import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleValid(MethodArgumentNotValidException e) {
		
		String msg = e.getBindingResult().getFieldErrors().isEmpty() ? "요청 오류"
				: e.getBindingResult().getFieldErrors().get(0).getDefaultMessage();
		
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", msg));
	}
}
