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
    public List<Article> list(@RequestParam Integer boardId) {
    	
    	return this.articleService.articleList(boardId);
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