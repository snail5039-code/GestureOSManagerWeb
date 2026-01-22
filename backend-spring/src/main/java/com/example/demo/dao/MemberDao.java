package com.example.demo.dao;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.example.demo.dto.Country;
import com.example.demo.dto.Member;

@Mapper
public interface MemberDao {

    // 1. 일반 회원가입
    @Insert("""
        insert into member(regdate, updatedate, loginid, loginpw, name, email, countryid, nickname, nicknameupdatedat)
        values (now(), now(), #{loginId}, #{loginPw}, #{name}, #{email}, #{countryId}, #{nickname}, now())
    """)
    void join(Member member);

    // 2. 소셜 사용자 조회
    @Select("""
        select *
        from member
        where provider = #{provider}
          and provider_key = #{providerKey}
    """)
    Member findByProviderAndKey(@Param("provider") String provider, @Param("providerKey") String providerKey);

    // 3. 소셜 사용자 insert
    @Options(useGeneratedKeys = true, keyProperty = "id")
    @Insert("""
        insert into member(regdate, updatedate, loginid, loginpw, name, email, countryid, provider, provider_key, nickname, nicknameupdatedat)
        values (now(), now(), #{loginId}, #{loginPw}, #{name}, #{email}, #{countryId}, #{provider}, #{providerKey}, #{nickname}, now())
    """)
    void insertSocial(Member member);

    // 4. 이메일 조회
    @Select("""
        select *
        from member
        where email = #{email}
    """)
    Member findByEmail(@Param("email") String email);

    // 5. 로그인아이디 조회
    @Select("""
        select *
        from member
        where loginid = #{loginId}
    """)
    Member findByLoginId(String loginId);

    // 6. ID로 조회
    @Select("""
        select *
        from member
        where id = #{id}
    """)
    Member findById(Integer id);

    // 7. 국가 목록
    @Select("""
        select *
        from country
        order by id asc
    """)
    List<Country> countries();

    // 8. 아이디 찾기
    @Select("""
        select loginid
        from member
        where name = #{name}
          and email = #{email}
    """)
    String findLoginIdByNameAndEmail(@Param("name") String name, @Param("email") String email);

    // 9. 비밀번호 찾기 검증용
    @Select("""
        select *
        from member
        where loginid = #{loginId}
          and email = #{email}
    """)
    Member findByLoginIdAndEmail(@Param("loginId") String loginId, @Param("email") String email);

    // 10. 비밀번호 재설정
    @Update("""
        update member
        set loginpw = #{tempPw},
            updatedate = now()
        where id = #{id}
    """)
    void updatePassword(@Param("id") Integer id, @Param("tempPw") String tempPw);

    @Update("""
        update member
        set
            loginpw = COALESCE(#{member.loginPw}, loginpw),
            updatedate = NOW(),
            name = COALESCE(NULLIF(#{member.name}, ''), name),
            email = COALESCE(NULLIF(#{member.email}, ''), email),
            countryid = COALESCE(#{member.countryId}, countryid),
            nickname = COALESCE(NULLIF(#{member.nickname}, ''), nickname),
            nicknameupdatedat = COALESCE(NULLIF(#{member.nicknameUpdatedAt}, '')::timestamp, nicknameupdatedat),
            profile_image_url = CASE
                WHEN #{member.resetProfileImage} THEN NULL
                ELSE COALESCE(NULLIF(#{member.profileImageUrl}, ''), profile_image_url)
            END
        where id = #{id}
    """)
    void memberModify(@Param("member") Member member, @Param("id") int id);

    @Delete("""
        delete from member
        where id = #{id}
    """)
    void memberDelete(int id);

    @Select("""
        select count(*) > 0
        from member
        where nickname = #{nickname}
    """)
    boolean existsByNickname(String nickname);

    @Select("""
        select count(*) > 0
        from member
        where loginid = #{loginId}
    """)
    boolean existsByLoginId(String loginId);

    @Update("""
        update member
        set profile_image_url = #{url}
        where id = #{memberId}
    """)
    void updateProfileImageUrl(@Param("memberId") int memberId, @Param("url") String url);
}
