package com.example.demo.dao;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.example.demo.dto.Comment;

@Mapper
public interface CommentDao {

    @Select("""
                SELECT c.*, m.name as writerName
                FROM comment c
                JOIN member m ON c.memberId = m.id
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

    @Delete("""
                DELETE FROM comment
                WHERE id = #{id}
            """)
    void delete(int id);

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
