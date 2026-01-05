package com.example.demo.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dto.Article;
import com.example.demo.service.ArticleService;

import jakarta.servlet.http.HttpSession;


@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api")
public class ArticleController {

    private final ArticleService articleService;
    public ArticleController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @PostMapping("/boards")
    public Map<String, Object> write(@RequestBody Article article, Authentication auth) {
    	
    	if (auth == null) {
    		throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인 필요");
    	}
    	
    	Integer loginMemberId = (Integer) auth.getPrincipal();
    	
    	if (article.getBoardId() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "boardId is required");
    	
    	article.setMemberId(loginMemberId);
        articleService.write(article);
        return Map.of("message", "작성완료");
    }

    @GetMapping("/boards")
    public Map<String, Object> list(
            @RequestParam(defaultValue = "1") int boardId,
            @RequestParam(defaultValue = "1") int cPage,
            @RequestParam(defaultValue = "") String searchKeyword,
            @RequestParam(defaultValue = "title") String searchType) {

        int itemsInAPage = 10;

        // 1. 디버깅 로그 (콘솔에서 articlesCnt가 9가 맞는지 꼭 확인하세요!)
        int articlesCnt = this.articleService.getArticlesCnt(boardId, searchType, searchKeyword.trim());
        System.out.println("디버깅 - boardId: " + boardId + ", 검색된 게시글 수: " + articlesCnt);

        // 2. 전체 페이지 수 계산 (나누기 시 반드시 double 형변환 확인)
        int totalPagesCnt = (int) Math.ceil((double) articlesCnt / itemsInAPage);
        if (totalPagesCnt < 1) totalPagesCnt = 1;

        // 3. 현재 페이지가 전체 페이지보다 크면 마지막 페이지로 강제 조정
        if (cPage > totalPagesCnt) {
            cPage = totalPagesCnt;
        }
        if (cPage < 1) cPage = 1;

        int limitFrom = (cPage - 1) * itemsInAPage;

        // 4. 페이지 블록 계산 (1~10 단위)
        int pageBlockSize = 10;
        int begin = ((cPage - 1) / pageBlockSize) * pageBlockSize + 1;
        int end = begin + pageBlockSize - 1;

        // ✅ 이 부분이 핵심: end는 반드시 totalPagesCnt를 넘을 수 없음
        if (end > totalPagesCnt) {
            end = totalPagesCnt;
        }

        // 5. 실제 리스트 가져오기
        List<Article> articles = this.articleService.showList(boardId, limitFrom, itemsInAPage, searchType,
                searchKeyword.trim());

        // 최종 데이터 확인 로그
        System.out.println("디버깅 - 결과: cPage=" + cPage + ", begin=" + begin + ", end=" + end + ", totalPages=" + totalPagesCnt);

        return Map.of(
                "articles", articles,
                "articlesCnt", articlesCnt,
                "totalPagesCnt", totalPagesCnt,
                "cPage", cPage,
                "begin", begin,
                "end", end,
                "boardId", boardId);
    }
    @GetMapping("/boards/{id}")
    public Article detail(@PathVariable int id) {
    	
        return articleService.articleDetail(id);
    }

    @PutMapping("/boards/{id}")
    public Map<String, Object> modify(@PathVariable int id, @RequestBody Article article, Authentication auth) {

        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        Integer loginMemberId = (Integer) auth.getPrincipal(); // JwtTokenProvider가 principal을 Integer로 넣는 전제
        article.setId(id);

        this.articleService.articleModify(article, loginMemberId);

        return Map.of("message", "수정완료");
    }


    @DeleteMapping("/boards/{id}")
    public Map<String, Object> delete(@PathVariable int id, Authentication auth) {

        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        Integer loginMemberId = (Integer) auth.getPrincipal();
        articleService.articleDelete(id, loginMemberId);

        return Map.of("message", "삭제완료");
    }

}