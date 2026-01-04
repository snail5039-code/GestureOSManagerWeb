package com.example.demo.openai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.Map;

@Service
public class OpenAiService {

    private final RestClient client;
    private final ObjectMapper om;
    private final String apiKey;
    private final String model;

    public OpenAiService(
            ObjectMapper om,
            @Value("${app.openai.api-key}") String apiKey,
            @Value("${app.openai.model:gpt-4.1-mini}") String model
    ) {
        this.om = om;
        this.apiKey = apiKey;
        this.model = model;

        this.client = RestClient.builder()
                .baseUrl("https://api.openai.com/v1")
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public String reply(String instructions, String input) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("OPENAI_API_KEY (app.openai.api-key) 가 설정되지 않았어.");
        }

        // ✅ JsonNode로 바로 받지 말고 String으로 받아서 파싱
        String raw = client.post()
                .uri("/responses")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .body(Map.of(
                        "model", model,
                        "instructions", instructions,
                        "input", (input == null ? "" : input)
                ))
                .retrieve()
                .body(String.class);

        try {
            JsonNode root = om.readTree(raw);
            return extractFirstOutputText(root);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse OpenAI response: " + raw, e);
        }
    }

    private String extractFirstOutputText(JsonNode root) {
        if (root == null) return "";
        JsonNode output = root.path("output");
        if (!output.isArray()) return "";

        for (JsonNode item : output) {
            JsonNode content = item.path("content");
            if (!content.isArray()) continue;

            for (JsonNode c : content) {
                if ("output_text".equals(c.path("type").asText())) {
                    return c.path("text").asText("");
                }
            }
        }
        return "";
    }
}
