package com.example.demo.dao;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ReactionDao {
    @Select("""
                SELECT COUNT(*)
                FROM reaction
                WHERE relTypeCode = #{relTypeCode}
                  AND relId = #{relId}
            """)
    int getReactionCount(@Param("relTypeCode") String relTypeCode, @Param("relId") int relId);

    @Select("""
                SELECT COUNT(*) > 0
                FROM reaction
                WHERE relTypeCode = #{relTypeCode}
                  AND relId = #{relId}
                  AND memberId = #{memberId}
            """)
    boolean hasReacted(@Param("relTypeCode") String relTypeCode, @Param("relId") int relId,
            @Param("memberId") int memberId);

    @Insert("""
                INSERT INTO reaction (relTypeCode, relId, memberId)
                VALUES (#{relTypeCode}, #{relId}, #{memberId})
            """)
    void insertReaction(@Param("relTypeCode") String relTypeCode, @Param("relId") int relId,
            @Param("memberId") int memberId);

    @Delete("""
                DELETE FROM reaction
                WHERE relTypeCode = #{relTypeCode}
                  AND relId = #{relId}
                  AND memberId = #{memberId}
            """)
    void deleteReaction(@Param("relTypeCode") String relTypeCode, @Param("relId") int relId,
            @Param("memberId") int memberId);

    @Select("""
                SELECT COUNT(*)
                FROM reaction
                WHERE relTypeCode = 'article'
                  AND memberId = #{memberId}
            """)
    int countArticleReactionsByMemberId(@Param("memberId") int memberId);
}
