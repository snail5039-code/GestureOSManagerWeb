package com.example.demo.dao;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.example.demo.dto.Article;

@Mapper
public interface ArticleDao {
	
	@Insert("""
	        INSERT INTO article (regDate, updateDate, title, content, boardId, memberId)
	        VALUES (NOW(), NOW(), #{title}, #{content}, #{boardId}, #{memberId})
	        """)
	int write(Article article);
	
	
	 @Select("""
		     SELECT a.*, m.loginId AS writerName
		        FROM article a
		        JOIN member m ON a.memberId = m.id
		        WHERE a.boardId = #{boardId}
		        ORDER BY a.id DESC
		    """)
	List<Article> articleListByBoardId(int boardId);

	@Select("""
			SELECT a.*, m.loginId AS writerName
				FROM article a
			    JOIN member m ON a.memberId = m.id
			    ORDER BY a.id DESC
			""")
	List<Article> articleList(); // 이거 일단 보류

	 @Select("""
		     SELECT a.*, m.loginId AS writerName
				FROM article a
			    JOIN member m ON a.memberId = m.id
			    WHERE a.id = #{id}
		     """)
	Article articleDetail(int id);

	@Update("""
			UPDATE article
				SET updateDate = NOW()
					,title = #{title}
					,content = #{content}
				WHERE id = #{id}
			""")
	int articleModify(Article article);

	@Delete("""
			DELETE FROM article
			WHERE id = #{id}
			""")
	int articleDelete(int id);
	

}
