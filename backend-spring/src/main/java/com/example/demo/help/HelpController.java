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
@CrossOrigin(origins = "http://localhost:5173")
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
            @RequestParam(defaultValue = "") String q
    ) {
        return service.list(category, q);
    }

    @GetMapping("/cards/{id}")
    public HelpCard detail(@PathVariable String id) {
        HelpCard c = service.get(id);
        if (c == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "not found");
        return c;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@RequestBody ChatRequest req) {
        String category = (req != null && req.context != null) ? req.context.category : "";
        String message = (req != null) ? req.message : "";

        var rec = service.recommend(category, message, 3);

        String cardsBrief = rec.stream()
                .map(c -> "- [" + c.id + "] " + c.title)
                .reduce("", (a, b) -> a + (a.isEmpty() ? "" : "\n") + b);

        String instructions =
                "너는 수어/화상통화 앱의 고객지원 챗봇이야. 한국어로 짧고 친절하게 답해. " +
                "아래 추천 카드 목록을 우선 확인하도록 안내해. 모르면 모른다고 말해.";

        String aiText = openAi.reply(
                instructions,
                "사용자 메시지: " + message + "\n카테고리: " + category + "\n추천 카드:\n" + cardsBrief
        );

        ChatResponse res = new ChatResponse();
        res.type = "cards";
        res.text = (aiText == null || aiText.isBlank())
                ? "관련 해결 방법을 찾았어! 아래 카드부터 확인해봐."
                : aiText;
        res.matched = rec.stream().map(c -> c.id).toList();
        return res;
    }
}
