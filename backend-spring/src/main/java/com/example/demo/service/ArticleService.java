package com.example.demo.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dao.ArticleDao;
import com.example.demo.dao.MemberDao;
import com.example.demo.dto.Article;
import com.example.demo.dto.Member;

@Service
public class ArticleService {

	private ArticleDao articleDao;
	private MemberDao memberDao;
	private ReactionService reactionService;

	public ArticleService(ArticleDao articleDao, MemberDao memberDao, ReactionService reactionService) {
		this.articleDao = articleDao;
		this.memberDao = memberDao;
		this.reactionService = reactionService;
	}

	public void write(Article article, Integer loginMemberId) {

		if (article.getMemberId() == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}

		if (article.getBoardId() == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "boardId is required");
		}

		// 공지사항(boardId=1)은 관리자만 작성 가능
		if (article.getBoardId() == 1) {
			Member loginMember = memberDao.findById(loginMemberId);

			if (loginMember == null || !"ADMIN".equals(loginMember.getRole())) {
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "공지사항은 관리자만 작성할 수 있습니다.");
			}
		}

		this.articleDao.write(article);
	}

	public List<Article> articleList(int boardId) {
		return this.articleDao.articleListByBoardId(boardId);
	}

	public Article articleDetail(int id, Integer loginMemberId) {
		Article a = this.articleDao.articleDetail(id);

		if (a == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 게시글은 존재하지 않습니다.");
		}

		// 좋아요 정보 설정
		a.setLikeCount(reactionService.getReactionCount("article", id));
		if (loginMemberId != null) {
			a.setIsLiked(reactionService.hasReacted("article", id, loginMemberId));
		} else {
			a.setIsLiked(false);
		}

		// 권한 플래그 설정
		if (loginMemberId != null) {
			Member loginMember = memberDao.findById(loginMemberId);

			if (loginMember != null) {
				boolean isWriter = a.getMemberId().equals(loginMemberId);
				boolean isAdmin = "ADMIN".equals(loginMember.getRole());

				a.setCanModify(isWriter || isAdmin);
				a.setCanDelete(isWriter || isAdmin);
			}
		}

		return a;
	}

	// private void checkAuthority(Article article, int loginMemberId) {
	//
	// Member loginMember = memberDao.findById(loginMemberId);
	//
	// if (loginMember == null) {
	// throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "회원 정보 없음");
	// }
	//
	// boolean isWriter = article.getMemberId().equals(loginMemberId);
	// boolean isAdmin = "ADMIN".equals(loginMember.getRole());
	//
	// if (!isWriter && !isAdmin) {
	// throw new ResponseStatusException(
	// HttpStatus.FORBIDDEN,
	// "작성자 또는 관리자만 가능합니다."
	// );
	// }
	// }

	public void articleModify(Article article, int loginMemberId) {

		Article existing = articleDetail(article.getId(), null); // 없으면 404

		Member loginMember = memberDao.findById(loginMemberId);

		boolean isWriter = existing.getMemberId().equals(loginMemberId);
		boolean isAdmin = "ADMIN".equals(loginMember.getRole());

		if (!isWriter && !isAdmin) {
			throw new ResponseStatusException(
					HttpStatus.FORBIDDEN,
					"작성자 또는 관리자만 수정할 수 있습니다.");
		}

		int rows = articleDao.articleModify(article);
		if (rows == 0) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "수정할 게시글이 없습니다.");
		}
	}

	public void articleDelete(int id, int loginMemberId) {

		Article existing = articleDetail(id, null); // 없으면 404

		Member loginMember = memberDao.findById(loginMemberId);

		boolean isWriter = existing.getMemberId().equals(loginMemberId);
		boolean isAdmin = "ADMIN".equals(loginMember.getRole());

		if (!isWriter && !isAdmin) {
			throw new ResponseStatusException(
					HttpStatus.FORBIDDEN,
					"작성자 또는 관리자만 삭제할 수 있습니다.");
		}

		int rows = articleDao.articleDelete(id);
		if (rows == 0) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 게시글은 존재하지 않습니다.");
		}
	}

	public int getArticlesCnt(int boardId, String searchType, String searchKeyword) {
		return articleDao.getArticlesCnt(boardId, searchType, searchKeyword);
	}

	public List<Article> showList(int boardId, int limitFrom, int itemsInAPage, String searchType,
			String searchKeyword) {
		return articleDao.getArticles(boardId, itemsInAPage, limitFrom, searchType, searchKeyword);
	}
}
