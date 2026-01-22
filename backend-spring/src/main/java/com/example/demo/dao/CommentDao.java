package com.example.demo.dao;

import java.util.List;

import org.apache.ibatis.annotations.*;

import com.example.demo.dto.Comment;

@Mapper
public interface CommentDao {

    // ✅ 500 방지: member 컬럼 mismatch로 터지는 걸 막기 위해 nickname만 안전 조회
    @Select("""
        SELECT
            c.*,
            COALESCE(m.nickname, m.name, 'User') AS writerNickname,
            m.profile_image_url AS writerProfileImageUrl
        FROM comment c
        LEFT JOIN member m ON c.memberId = m.id
        WHERE c.relTypeCode = #{relTypeCode}
          AND c.relId = #{relId}
        ORDER BY c.id ASC
    """)
    List<Comment> selectByRel(@Param("relTypeCode") String relTypeCode, @Param("relId") int relId);

    @Insert("""
        INSERT INTO comment (relTypeCode, relId, memberId, content, parentId, regDate, updateDate)
        VALUES (#{relTypeCode}, #{relId}, #{memberId}, #{content}, #{parentId}, NOW(), NOW())
    """)
    void insert(Comment comment);

    @Select("""
        SELECT *
        FROM comment
        WHERE id = #{id}
    """)
    Comment selectById(int id);

    @Update("""
        UPDATE comment
        SET content = #{content},
            updateDate = NOW()
        WHERE id = #{id}
    """)
    void update(Comment comment);

    // ✅ 자식댓글 조회 (삭제 시 같이 지우기 위해)
    @Select("""
        SELECT id
        FROM comment
        WHERE parentId = #{parentId}
        ORDER BY id ASC
    """)
    List<Integer> selectChildIds(@Param("parentId") int parentId);

    @Delete("""
        DELETE FROM comment
        WHERE id = #{id}
    """)
    void delete(@Param("id") int id);

    @Select("""
        SELECT *
        FROM comment
        WHERE memberId = #{memberId}
        ORDER BY id DESC
    """)
    List<Comment> selectByMemberId(int memberId);

    @Select("""
        SELECT COUNT(*)
        FROM comment
        WHERE memberId = #{memberId}
    """)
    int countByMemberId(int memberId);
}
