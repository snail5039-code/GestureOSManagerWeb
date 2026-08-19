package com.example.demo.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.example.demo.dto.KcisaItem;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class KcisaIngestService {

    // 인증키는 소스에 두지 않는다. 환경변수 KCISA_SERVICE_KEY 로 주입한다.
    private final String baseUrl;
    private final String serviceKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper om = new ObjectMapper();

    public KcisaIngestService(
            @Value("${kcisa.base-url}") String baseUrl,
            @Value("${kcisa.service-key:}") String serviceKey) {
        this.baseUrl = baseUrl;
        this.serviceKey = serviceKey;
    }

    /** 인증키가 없으면 외부 호출을 시도하지 않는다. */
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank();
    }

    /** 원본 JSON 응답 (디버깅용). 인증키가 없으면 빈 객체를 준다. */
    public String rawJson(int pageNo, int numOfRows, String keyword) {
        if (!isConfigured()) return "{}";
        return restTemplate.getForObject(buildUrl(pageNo, numOfRows, keyword), String.class);
    }

    private String buildUrl(int pageNo, int numOfRows, String keyword) {
        var b = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("serviceKey", serviceKey)
                .queryParam("pageNo", pageNo)
                .queryParam("numOfRows", numOfRows);

        if (keyword != null && !keyword.isBlank()) {
            b.queryParam("keyword", keyword);
        }
        return b.build().toUriString();
    }

    public List<KcisaItem> items(int pageNo, int numOfRows, String keyword) {
        if (!isConfigured()) return List.of();

        var b = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("serviceKey", serviceKey)
                .queryParam("pageNo", pageNo)
                .queryParam("numOfRows", numOfRows);

        if (keyword != null && !keyword.isBlank()) {
            b.queryParam("keyword", keyword);
        }

        String url = b.build().toUriString();
        String json = restTemplate.getForObject(url, String.class);

        try {
            Map<String, Object> root = om.readValue(json, Map.class);

            Map<String, Object> response = asMap(root.get("response"));
            if (response == null) return List.of();

            Map<String, Object> body = asMap(response.get("body"));
            if (body == null) return List.of();

            Map<String, Object> items = asMap(body.get("items"));
            if (items == null) return List.of();

            Object itemObj = items.get("item");
            if (itemObj == null) return List.of();

            List<Map<String, Object>> itemList = toItemList(itemObj);

            List<KcisaItem> out = new ArrayList<>();
            for (Map<String, Object> it : itemList) {
                String title = asString(it.get("title"));
                String videoUrl = asString(it.get("subDescription"));
                String thumbUrl = asString(it.get("referenceIdentifier"));
                String detailUrl = asString(it.get("url"));
                out.add(new KcisaItem(title, videoUrl, thumbUrl, detailUrl));
            }
            return out;

        } catch (Exception e) {
            throw new RuntimeException("KCISA JSON parse fail: " + e.getMessage(), e);
        }
    }

    public List<KcisaItem> search(String keyword, int limit) {
        return items(1, limit, keyword);
    }

    public KcisaItem findBest(String title) {
        List<KcisaItem> list = items(1, 20, title);

        if (list == null || list.isEmpty()) return null;

        for (KcisaItem it : list) {
            if (it.getTitle() != null && it.getTitle().equals(title)) return it;
        }

        String t1 = title.replace(" ", "");
        for (KcisaItem it : list) {
            if (it.getTitle() == null) continue;
            if (it.getTitle().replace(" ", "").equals(t1)) return it;
        }

        for (KcisaItem it : list) {
            if (it.getTitle() == null) continue;
            if (it.getTitle().contains(title) || title.contains(it.getTitle())) return it;
        }

        return list.get(0);
    }

    // ---- helpers ----
    private Map<String, Object> asMap(Object o) {
        return (o instanceof Map) ? (Map<String, Object>) o : null;
    }

    private String asString(Object o) {
        return (o == null) ? null : String.valueOf(o);
    }

    private List<Map<String, Object>> toItemList(Object itemObj) {
        if (itemObj instanceof List) return (List<Map<String, Object>>) itemObj;
        if (itemObj instanceof Map) return List.of((Map<String, Object>) itemObj);
        return List.of();
    }
}
