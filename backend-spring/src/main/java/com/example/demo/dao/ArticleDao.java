package com.example.demo.dao;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.example.demo.dto.Article;

@Mapper
public interface ArticleDao {

	@Insert("""
			INSERT INTO article (regDate, updateDate, title, content, boardId, memberId, hit)
			VALUES (NOW(), NOW(), #{title}, #{content}, #{boardId}, #{memberId}, 0)
			""")
	int write(Article article);

	@Select("""
			 SELECT a.*, m.nickname AS writerName, 
			 	m.profile_image_url AS writerProfileImageUrl
			    FROM article a
			    JOIN member m ON a.memberId = m.id
			    WHERE a.boardId = #{boardId}
			    ORDER BY a.id DESC
			""")
	List<Article> articleListByBoardId(int boardId);

	@Select("""
		    SELECT a.*, 
		           m.nickname AS writerName,
		           m.profile_image_url AS writerProfileImageUrl
		    FROM article a
		    JOIN member m ON a.memberId = m.id
		    ORDER BY a.id DESC
		""")
	List<Article> articleList();

	@Select("""
			   SELECT a.*, 
			          m.nickname AS writerName,
			          m.profile_image_url AS writerProfileImageUrl,
			          (SELECT COUNT(*)
			           FROM comment c
			           WHERE c.relTypeCode = 'article' AND c.relId = a.id) AS commentCount
			   FROM article a
			   JOIN member m ON a.memberId = m.id
			   WHERE a.id = #{id}
			""")
			Article articleDetail(int id);

	@Update("""
			UPDATE article
			SET hit = COALESCE(hit, 0) + 1
			WHERE id = #{id}
			""")
	int increaseHit(int id);

	@Select("""
			SELECT hit
			FROM article
			WHERE id = #{id}
			""")
	Integer getHit(int id);

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

	@Select("""
			<script>
			SELECT COUNT(*)
			FROM article a
			WHERE a.boardId = #{boardId}
			<if test="searchKeyword != null and searchKeyword != ''">
				<choose>
					<when test="searchType == 'title'">
						AND a.title LIKE CONCAT('%', #{searchKeyword}, '%')
					</when>
					<when test="searchType == 'content'">
						AND a.content LIKE CONCAT('%', #{searchKeyword}, '%')
					</when>
					<when test="searchType == 'title,content'">
						AND (a.title LIKE CONCAT('%', #{searchKeyword}, '%') OR a.content LIKE CONCAT('%', #{searchKeyword}, '%'))
					</when>
				</choose>
			</if>
			</script>
			""")
	int getArticlesCnt(@Param("boardId") int boardId,
			@Param("searchType") String searchType,
			@Param("searchKeyword") String searchKeyword);

	@Select("""
			<script>
			SELECT a.*, m.nickname AS writerName,
				   m.profile_image_url AS writerProfileImageUrl,
			       (SELECT COUNT(*)
			        FROM comment c
			        WHERE c.relTypeCode = 'article' AND c.relId = a.id) AS commentCount
			FROM article a
			JOIN member m ON a.memberId = m.id
			WHERE a.boardId = #{boardId}
			<if test="searchKeyword != null and searchKeyword != ''">
				<choose>
					<when test="searchType == 'title'">
						AND a.title LIKE CONCAT('%', #{searchKeyword}, '%')
					</when>
					<when test="searchType == 'content'">
						AND a.content LIKE CONCAT('%', #{searchKeyword}, '%')
					</when>
					<when test="searchType == 'title,content'">
						AND (a.title LIKE CONCAT('%', #{searchKeyword}, '%') OR a.content LIKE CONCAT('%', #{searchKeyword}, '%'))
					</when>
				</choose>
			</if>
			<choose>
				<when test="sortType == 'views'">
					ORDER BY COALESCE(a.hit, 0) DESC, a.id DESC
				</when>
				<when test="sortType == 'comments'">
					ORDER BY commentCount DESC, a.id DESC
				</when>
				<otherwise>
					ORDER BY a.id DESC
				</otherwise>
			</choose>
			LIMIT #{limit} OFFSET #{offset}
			</script>
			""")
	List<Article> getArticles(@Param("boardId") int boardId,
			@Param("limit") int limit,
			@Param("offset") int offset,
			@Param("searchType") String searchType,
			@Param("searchKeyword") String searchKeyword,
			@Param("sortType") String sortType);

	@Select("""
			SELECT a.*, m.nickname AS writerName
			FROM article a
			JOIN member m ON a.memberId = m.id
			WHERE a.memberId = #{memberId}
			ORDER BY a.id DESC
			""")
	List<Article> selectByMemberId(int memberId);

	@Select("""
		    SELECT a.*, 
		           m.nickname AS writerName,
		           m.profile_image_url AS writerProfileImageUrl
		    FROM article a
		    JOIN member m ON a.memberId = m.id
		    JOIN reaction r ON a.id = r.relId
		    WHERE r.memberId = #{memberId}
		      AND r.relTypeCode = 'article'
		    ORDER BY r.regDate DESC
		""")
	List<Article> selectLikedByMemberId(int memberId);

	@Select("SELECT COUNT(*) FROM article WHERE memberId = #{memberId}")
	int countByMemberId(int memberId);
}
