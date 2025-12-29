package com.example.demo.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dao.ArticleDao;
import com.example.demo.dto.Article;

@Service
public class ArticleService {
	
	private ArticleDao articleDao;
	public ArticleService(ArticleDao articleDao) {
		this.articleDao = articleDao;
	}
	
	public void write(Article article) {
		
	    if (article.getMemberId() == null) {
	        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
	    }
	    
	    if (article.getBoardId() == null) {
	        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "boardId is required");
	    }
	    
	    this.articleDao.write(article);
	}


//	public List<Article> articleList() {
//	    return this.articleDao.articleList();
//	}
	
	public List<Article> articleList(int boardId) {
		return this.articleDao.articleListByBoardId(boardId);
	}

	public Article articleDetail(int id) {
		Article a = this.articleDao.articleDetail(id);
		
		if (a == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 게시글은 존재하지 않습니다.");
		}
		return a;
	}

	public void articleModify(Article article, int loginMemberId) {
        Article existing = articleDetail(article.getId()); // 없으면 404 처리

        if (existing.getMemberId() == null || !existing.getMemberId().equals(loginMemberId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "작성자만 수정할 수 있습니다.");
        }
        
        int rows = this.articleDao.articleModify(article);
        if (rows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "수정할 게시글이 없습니다.");
        }
	}

	public void articleDelete(int id, int loginMemberId) {
		Article existing = articleDetail(id); // 없으면 404
		
		if (existing.getMemberId() == null || !existing.getMemberId().equals(loginMemberId)) {
		    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "작성자만 삭제할 수 있습니다.");
		}
		
		int rows = this.articleDao.articleDelete(id);
		if(rows == 0) {
			// http상태코드를  의도적으로 실패로 만들기 위한 예외
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 게시글은 존재하지 않습니다.");
		} 

	}
}
