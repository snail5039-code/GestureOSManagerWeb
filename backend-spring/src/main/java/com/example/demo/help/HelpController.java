package com.example.demo.help;

import com.example.demo.help.HelpCardDtos.ChatRequest;
import com.example.demo.help.HelpCardDtos.ChatResponse;
import com.example.demo.help.HelpCardDtos.HelpCard;
import com.example.demo.openai.OpenAiService;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/help")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174"})
public class HelpController {

    private final HelpCardService service;
    private final OpenAiService openAi;

    public HelpController(HelpCardService service, OpenAiService openAi) {
        this.service = service;
        this.openAi = openAi;
    }

    @GetMapping("/categories")
    public List<String> categories() {
        return service.categories();
    }

    @GetMapping("/cards")
    public List<HelpCard> list(
            @RequestParam(defaultValue = "") String category,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "ko") String lang
    ) {
        return service.list(category, q, lang);
    }

    @GetMapping("/cards/{id}")
    public HelpCard detail(
            @PathVariable String id,
            @RequestParam(defaultValue = "ko") String lang
    ) {
        HelpCard c = service.get(id, lang);
        if (c == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "not found");
        return c;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@RequestBody ChatRequest req) {

        String category = (req != null && req.context != null) ? nz(req.context.category) : "";
        String lang     = (req != null && req.context != null) ? nz(req.context.lang) : "ko";
        String message  = (req != null) ? nz(req.message) : "";
        String lastQ    = (req != null && req.context != null) ? nz(req.context.lastQuestionType) : "";

        String msgRaw = message == null ? "" : message.trim();

        if (msgRaw.isBlank()) {
            return mk("cards", t(lang,
                    "응, 무슨 일이야?",
                    "Okay, what’s up?",
                    "うん、どうした？"
            ), List.of(), "ASK_PROBLEM_TYPE");
        }

        String low = msgRaw.toLowerCase();
        if (containsAny(low,
                "자살", "죽고", "죽을", "목숨", "끝내고", "마포대교",
                "suicide", "kill myself", "end my life",
                "自殺", "死にたい"
        )) {
            return mk("cards", t(lang,
                    "지금은 네 안전이 제일 중요해. 혼자 버티지 말고 주변 도움을 꼭 받아.",
                    "Your safety matters most right now. Please reach out to someone nearby for help.",
                    "今は安全が一番大事。ひとりで抱えず、周りの助けを必ず頼って。"
            ), List.of(), "SAFETY_CHECK");
        }

        OpenAiService.DialogPlan plan;
        try {
            List<ChatRequest.HistoryItem> hist = (req != null ? req.history : null);
            plan = openAi.dialogPlan(msgRaw, category, lastQ, lang, hist, 5);
        } catch (Exception e) {
            plan = null;
        }

        if (plan == null || plan.text == null || plan.text.isBlank()) {
            return mk("cards", t(lang,
                    "잠깐 오류가 있었어. 방금 말한 걸 한 번만 더 보내줘!",
                    "Something glitched. Send that one more time!",
                    "ちょっと不具合。さっきの内容をもう一回送って！"
            ), List.of(), "ASK_PROBLEM_TYPE");
        }

        String intent = (plan.intent == null || plan.intent.isBlank()) ? "PROBLEM" : plan.intent;
        String nextQ  = (plan.nextQuestionType == null || plan.nextQuestionType.isBlank())
                ? "ASK_FOLLOWUP"
                : plan.nextQuestionType;

        if (plan.stateEnded || "CHITCHAT".equals(intent) || "FRUSTRATION".equals(intent)) {
            return mk("cards", plan.text, List.of(), nextQ);
        }

        String catForRec = (plan.category == null || plan.category.isBlank())
                ? category
                : plan.category;

        var rr = service.recommend(catForRec, msgRaw, 3);
        var ids = rr.cards.stream().map(c -> c.id).toList();

        return mk("cards", plan.text, ids, nextQ);
    }

    private static String nz(String s) { return s == null ? "" : s; }

    private static boolean containsAny(String hay, String... needles) {
        if (hay == null) return false;
        for (String n : needles) if (hay.contains(n)) return true;
        return false;
    }

    private static ChatResponse mk(String type, String text, List<String> matched, String nextQ) {
        ChatResponse r = new ChatResponse();
        r.type = type;
        r.text = text;
        r.matched = matched;
        r.nextQuestionType = nextQ;
        return r;
    }

    private static String t(String lang, String ko, String en, String ja) {
        if (lang == null) return ko;
        String x = lang.toLowerCase();
        if (x.contains("-")) x = x.split("-")[0];
        if (x.contains("_")) x = x.split("_")[0];
        return switch (x) {
            case "en" -> en;
            case "ja" -> ja;
            default -> ko;
        };
    }
    
    @GetMapping("/debug/lang")
    public String debugLang(@RequestParam(defaultValue="ko") String lang,
                            @RequestParam(defaultValue="camera") String category) {

        var list = service.list(category, "", lang);
        String first = (list != null && !list.isEmpty() && list.get(0) != null)
                ? String.valueOf(list.get(0).title)
                : "(empty)";

        return "lang=" + lang + " category=" + category
                + " size=" + (list == null ? 0 : list.size())
                + " firstTitle=" + first;
    }

}
