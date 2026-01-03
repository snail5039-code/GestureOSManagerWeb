package com.example.demo.dao;

import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import com.example.demo.dto.Country;
import com.example.demo.dto.Member;

@Mapper
public interface MemberDao {

    // 1. 일반 회원가입 (기존 유지)
    @Insert("""
        insert into member(regdate, updatedate, loginid, loginpw, name, email, countryid)
        values (now(), now(), #{loginId}, #{loginPw}, #{name}, #{email}, #{countryId})
    """)
    void join(Member member);

    // 2. 서비스의 upsertSocialUser에서 사용하는 조회 로직 (필수)
    @Select("""
        select *
        from member
        where provider = #{provider}
          and provider_key = #{providerKey}
    """)
    Member findByProviderAndKey(@Param("provider") String provider, @Param("providerKey") String providerKey);

    // 3. 서비스의 upsertSocialUser에서 사용하는 저장 로직 (필수)
    // @Options는 DB에서 생성된 id값을 다시 Member 객체에 채워주기 위해 꼭 필요합니다.
    @Options(useGeneratedKeys = true, keyProperty = "id")
    @Insert("""
        insert into member(regdate, updatedate, loginid, loginpw, name, email, countryid, provider, provider_key)
        values (now(), now(), #{loginId}, #{loginPw}, #{name}, #{email}, #{countryId}, #{provider}, #{providerKey})
    """)
    void insertSocial(Member member);

    // 4. 기존에 있던 이메일 조회 로직 (유지)
    @Select("""
        select *
        from member
        where email = #{email}
    """)
    Member findByEmail(@Param("email") String email);

    // 5. 기존에 있던 로그인아이디 조회 로직 (유지)
    @Select("""
        select *
        from member
        where loginid = #{loginId}
    """)
    Member findByLoginId(String loginId);

    // 6. ID로 회원 찾기 (유지)
    @Select("""
        SELECT *
        FROM member
        WHERE id = #{id}
    """)
    Member findById(Integer id);
    
    // 7. 국가 목록 (유지)
    @Select("""
        SELECT *
        FROM country
        order by id asc
    """)
    List<Country> countries();
}