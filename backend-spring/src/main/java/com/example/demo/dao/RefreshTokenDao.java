package com.example.demo.dao;

import java.util.Optional;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.example.demo.dto.RefreshToken;

@Mapper
public interface RefreshTokenDao {

  @Insert("""
    insert into refresh_tokens(member_id, token, updated_at)
    values (#{memberId}, #{token}, now())
    on conflict (member_id)
    do update set token = excluded.token, updated_at = now()
  """)
  void upsert(@Param("memberId") Integer memberId, @Param("token") String token);

  @Select("""
    select member_id as memberId, token
    from refresh_tokens
    where member_id = #{memberId}
  """)
  Optional<RefreshToken> findByMemberId(@Param("memberId") Integer memberId);

  @Delete("""
    delete from refresh_tokens
    where member_id = #{memberId}
  """)
  void deleteByMemberId(@Param("memberId") Integer memberId);
}
