package com.example.demo.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.example.demo.dto.KcisaItem;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class KcisaIngestService {

    private static final String BASE_URL = "https://api.kcisa.kr/openapi/service/rest/meta13/getCTE01701";
    private static final String SERVICE_KEY = "1099ca75-c757-450f-bb0f-3f7f4d90833f";

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper om = new ObjectMapper();

    public List<KcisaItem> items(int pageNo, int numOfRows, String keyword) {
        var b = UriComponentsBuilder.fromUriString(BASE_URL)
                .queryParam("serviceKey", SERVICE_KEY)
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
