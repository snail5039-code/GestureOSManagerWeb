package com.example.demo.help;

import com.example.demo.help.HelpCardDtos.HelpCard;
import com.example.demo.help.HelpCardDtos.HelpCardsFile;
import com.example.demo.openai.OpenAiService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class HelpCardService {

    private final ObjectMapper om;
    private final OpenAiService openAi;

    private final Path vectorCachePath;
    private final boolean buildEmbeddingsOnStartup;

    private final Map<String, float[]> vectors = new HashMap<>();

    private List<HelpCard> cards = new ArrayList<>();
    private Map<String, HelpCard> byId = new HashMap<>();

    public HelpCardService(
            ObjectMapper om,
            OpenAiService openAi,
            @Value("${app.help.vector-cache-path:./data/help-vectors.json}") String vectorCachePath,
            @Value("${app.help.build-embeddings-on-startup:false}") boolean buildEmbeddingsOnStartup
    ) {
        this.om = om;
        this.openAi = openAi;
        this.vectorCachePath = Paths.get(vectorCachePath);
        this.buildEmbeddingsOnStartup = buildEmbeddingsOnStartup;
    }

    @PostConstruct
    public void load() {
        // 1) 카드 로드
        HelpCardsFile file;
        try {
            ClassPathResource res = new ClassPathResource("help/help-cards.json");
            try (InputStream is = res.getInputStream()) {
                file = om.readValue(is, HelpCardsFile.class);
                this.cards = (file != null && file.cards != null) ? file.cards : new ArrayList<>();
                this.byId = this.cards.stream()
                        .filter(c -> c != null && c.id != null)
                        .collect(Collectors.toMap(c -> c.id, c -> c, (a, b) -> a));
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to load help/help-cards.json", e);
        }

        // 2) 벡터 캐시 로드(있으면 재사용)
        HelpVectorCache cache = readVectorCacheSafe();
        Map<String, HelpVectorCache.Entry> cached = (cache != null && cache.vectors != null)
                ? cache.vectors
                : new HashMap<>();

        vectors.clear();

        int reused = 0;
        for (HelpCard c : cards) {
            if (c == null || c.id == null) continue;

            HelpVectorCache.Entry hit = cached.get(c.id);
            if (hit != null && hit.vector != null && hit.vector.length > 0) {
                vectors.put(c.id, hit.vector);
                reused++;
            }
        }

        // ✅ 여기서부터 “새 임베딩 생성”은 옵션 + 키 있을 때만
        if (!buildEmbeddingsOnStartup) {
            System.out.println("[HelpCardService] embeddings: startup build disabled. reused=" + reused + " totalVectors=" + vectors.size());
            return;
        }
        if (!openAi.isApiKeyReady()) {
            System.out.println("[HelpCardService] embeddings: no api key. reused=" + reused + " totalVectors=" + vectors.size());
            return;
        }

        // 3) 카드별 hash 비교해서 변경된 것만 생성
        int created = 0;

        for (HelpCard c : cards) {
            if (c == null || c.id == null) continue;

            String embedText = toEmbeddingText(c);
            String hash = sha256(embedText);

            HelpVectorCache.Entry hit = cached.get(c.id);
            if (hit != null && hash.equals(hit.hash) && hit.vector != null && hit.vector.length > 0) {
                // 이미 위에서 vectors에 넣었을 수도 있지만 안전하게
                vectors.put(c.id, hit.vector);
                continue;
            }

            try {
                float[] vec = openAi.embedOne(embedText);
                if (vec != null && vec.length > 0) {
                    vectors.put(c.id, vec);
                    cached.put(c.id, new HelpVectorCache.Entry(hash, vec));
                    created++;
                }
            } catch (Exception ex) {
                // 실패해도 서버는 떠야 함
                System.out.println("[HelpCardService] embedding failed cardId=" + c.id + " msg=" + ex.getClass().getSimpleName());
            }
        }

        // 4) 캐시 저장
        HelpVectorCache out = new HelpVectorCache();
        out.version = (file != null ? file.version : "unknown");
        out.updatedAt = (file != null ? file.updatedAt : null);
        out.embeddingModel = "openai";
        out.vectors = cached;

        writeVectorCacheSafe(out);

        System.out.println("[HelpCardService] embeddings: reused=" + reused + " created=" + created + " totalVectors=" + vectors.size());
    }

    public List<String> categories() {
        return cards.stream()
                .map(c -> c.category)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    public List<HelpCard> list(String category, String q) {
        String cat = normalize(category);
        String qq = normalize(q);

        return cards.stream()
                .filter(Objects::nonNull)
                .filter(c -> cat.isBlank() || normalize(c.category).equals(cat))
                .filter(c -> qq.isBlank() || matches(c, qq))
                .limit(200)
                .toList();
    }

    public HelpCard get(String id) {
        return byId.get(id);
    }

    public RecommendResult recommend(String category, String message, int limit) {
        String cat = normalize(category);
        String msg = (message == null) ? "" : message.trim();

        if (msg.isBlank()) {
            List<HelpCard> fb = fallback(cat, limit);
            return new RecommendResult(fb, 0.0, false);
        }

        // 임베딩 캐시가 없으면 token 폴백
        if (vectors.isEmpty() || !openAi.isApiKeyReady()) {
            List<HelpCard> fb = recommendByTokens(cat, msg, limit);
            return new RecommendResult(fb, 0.0, false);
        }

        float[] q;
        try {
            q = openAi.embedOne(msg);
        } catch (Exception e) {
            List<HelpCard> fb = recommendByTokens(cat, msg, limit);
            return new RecommendResult(fb, 0.0, false);
        }

        if (q == null || q.length == 0) {
            List<HelpCard> fb = recommendByTokens(cat, msg, limit);
            return new RecommendResult(fb, 0.0, false);
        }

        List<ScoredD> scored = new ArrayList<>();
        double maxSim = 0.0;

        for (HelpCard c : cards) {
            if (c == null || c.id == null) continue;
            if (!cat.isBlank() && !normalize(c.category).equals(cat)) continue;

            float[] v = vectors.get(c.id);
            if (v == null || v.length == 0) continue;

            double sim = cosine(q, v);
            if (sim > maxSim) maxSim = sim;
            scored.add(new ScoredD(c, sim));
        }

        if (scored.isEmpty()) {
            List<HelpCard> fb = recommendByTokens(cat, msg, limit);
            return new RecommendResult(fb, 0.0, false);
        }

        List<HelpCard> res = scored.stream()
                .sorted((x, y) -> Double.compare(y.sim, x.sim))
                .limit(limit)
                .map(s -> s.card)
                .toList();

        if (res.isEmpty()) {
            List<HelpCard> fb = fallback(cat, limit);
            return new RecommendResult(fb, 0.0, false);
        }

        return new RecommendResult(res, maxSim, true);
    }

    private double cosine(float[] a, float[] b) {
        int n = Math.min(a.length, b.length);
        double dot = 0, na = 0, nb = 0;
        for (int i = 0; i < n; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        if (na == 0 || nb == 0) return 0;
        return dot / (Math.sqrt(na) * Math.sqrt(nb));
    }

    private static class ScoredD {
        HelpCard card;
        double sim;
        ScoredD(HelpCard c, double s) { this.card = c; this.sim = s; }
    }

    private boolean matches(HelpCard c, String qq) {
        String t = normalize(c.title);
        if (!t.isBlank() && t.contains(qq)) return true;

        if (c.symptoms != null) for (String s : c.symptoms) if (normalize(s).contains(qq)) return true;
        if (c.tags != null) for (String s : c.tags) if (normalize(s).contains(qq)) return true;
        return false;
    }

    private List<HelpCard> fallback(String cat, int limit) {
        List<String> ids;
        if ("call".equals(cat)) ids = List.of("call-010", "call-001", "call-007");
        else if ("error".equals(cat)) ids = List.of("err-001", "err-003", "err-008");
        else ids = List.of("cam-001", "cam-004", "cam-005");

        List<HelpCard> res = new ArrayList<>();
        for (String id : ids) {
            HelpCard c = byId.get(id);
            if (c != null) res.add(c);
            if (res.size() >= limit) break;
        }

        if (res.isEmpty()) {
            for (HelpCard c : cards) {
                if (c == null) continue;
                if (!cat.isBlank() && !normalize(c.category).equals(cat)) continue;
                res.add(c);
                if (res.size() >= limit) break;
            }
        }
        return res;
    }

    private List<HelpCard> recommendByTokens(String cat, String msgNorm, int limit) {
        String msg = normalize(msgNorm);
        List<Scored> scored = new ArrayList<>();

        for (HelpCard c : cards) {
            if (c == null) continue;
            if (!cat.isBlank() && !normalize(c.category).equals(cat)) continue;

            int s = scoreTokens(c, msg);
            if (s > 0) scored.add(new Scored(c, s));
        }

        List<HelpCard> res = scored.stream()
                .sorted((x, y) -> Integer.compare(y.score, x.score))
                .limit(limit)
                .map(x -> x.card)
                .toList();

        return res.isEmpty() ? fallback(cat, limit) : res;
    }

    private int scoreTokens(HelpCard c, String msgNorm) {
        Set<String> msgTokens = tokenize(msgNorm);
        if (msgTokens.isEmpty()) return 0;

        int score = 0;
        score += tokenHit(msgTokens, normalize(c.title)) * 2;

        if (c.symptoms != null) for (String s : c.symptoms) score += tokenHit(msgTokens, normalize(s)) * 6;
        if (c.tags != null) for (String t : c.tags) score += tokenHit(msgTokens, normalize(t)) * 3;
        if (c.quickChecks != null) for (String q : c.quickChecks) score += tokenHit(msgTokens, normalize(q)) * 1;
        if (c.steps != null) {
            for (var st : c.steps) {
                score += tokenHit(msgTokens, normalize(st.label)) * 1;
                score += tokenHit(msgTokens, normalize(st.detail)) * 1;
            }
        }
        return score;
    }

    private int tokenHit(Set<String> msgTokens, String textNorm) {
        if (textNorm == null || textNorm.isBlank()) return 0;
        Set<String> tks = tokenize(textNorm);
        int hit = 0;
        for (String tk : tks) if (msgTokens.contains(tk)) hit++;
        return hit;
    }

    private Set<String> tokenize(String norm) {
        if (norm == null || norm.isBlank()) return Set.of();
        String[] parts = norm.split(" ");
        Set<String> out = new HashSet<>();
        for (String p : parts) if (p.length() >= 2) out.add(p);
        return out;
    }

    private String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase()
                .replaceAll("[^a-z0-9가-힣\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static class Scored {
        HelpCard card;
        int score;
        Scored(HelpCard c, int s) { this.card = c; this.score = s; }
    }

    private String toEmbeddingText(HelpCard c) {
        StringBuilder sb = new StringBuilder();
        sb.append("id: ").append(n(c.id)).append("\n");
        sb.append("category: ").append(n(c.category)).append("\n");
        sb.append("title: ").append(n(c.title)).append("\n");

        if (c.symptoms != null && !c.symptoms.isEmpty())
            sb.append("symptoms: ").append(String.join(", ", c.symptoms)).append("\n");

        if (c.tags != null && !c.tags.isEmpty())
            sb.append("tags: ").append(String.join(", ", c.tags)).append("\n");

        if (c.quickChecks != null && !c.quickChecks.isEmpty())
            sb.append("quickChecks: ").append(String.join(" | ", c.quickChecks)).append("\n");

        if (c.steps != null && !c.steps.isEmpty()) {
            sb.append("steps:\n");
            for (var st : c.steps) {
                sb.append("- ").append(n(st.label)).append(": ").append(n(st.detail)).append("\n");
            }
        }
        return sb.toString();
    }

    private String n(String s) { return s == null ? "" : s; }

    public static class RecommendResult {
        public final List<HelpCard> cards;
        public final double maxSim;
        public final boolean usedEmbeddings;
        public RecommendResult(List<HelpCard> cards, double maxSim, boolean usedEmbeddings) {
            this.cards = cards;
            this.maxSim = maxSim;
            this.usedEmbeddings = usedEmbeddings;
        }
    }

    private static class HelpVectorCache {
        public String version;
        public String updatedAt;
        public String embeddingModel;
        public Map<String, Entry> vectors;

        public static class Entry {
            public String hash;
            public float[] vector;

            public Entry() {}
            public Entry(String hash, float[] vector) {
                this.hash = hash;
                this.vector = vector;
            }
        }
    }

    private HelpVectorCache readVectorCacheSafe() {
        try {
            if (!Files.exists(vectorCachePath)) return null;
            String json = Files.readString(vectorCachePath, StandardCharsets.UTF_8);
            return om.readValue(json, HelpVectorCache.class);
        } catch (Exception e) {
            return null;
        }
    }

    private void writeVectorCacheSafe(HelpVectorCache cache) {
        try {
            Path parent = vectorCachePath.getParent();
            if (parent != null) Files.createDirectories(parent);

            String json = om.writerWithDefaultPrettyPrinter().writeValueAsString(cache);
            Files.writeString(vectorCachePath, json, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (Exception e) {
            // ignore
        }
    }

    private String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(Objects.hashCode(s));
        }
    }
}
