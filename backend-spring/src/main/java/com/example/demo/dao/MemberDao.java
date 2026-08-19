package com.example.demo.dao;

import java.util.List;
import org.apache.ibatis.annotations.*;
import com.example.demo.dto.Country;
import com.example.demo.dto.Member;

@Mapper
public interface MemberDao {

    // 1. 일반 회원가입
    @Insert("""
        INSERT INTO member(regdate, updatedate, loginid, loginpw, name, email, countryid, nickname, nicknameupdatedat)
        VALUES (NOW(), NOW(), #{loginId}, #{loginPw}, #{name}, #{email}, #{countryId}, #{nickname}, NOW())
    """)
    void join(Member member);

    // 2. 소셜 사용자 조회
    @Select("""
        SELECT *
        FROM member
        WHERE provider = #{provider}
          AND provider_key = #{providerKey}
    """)
    Member findByProviderAndKey(@Param("provider") String provider, @Param("providerKey") String providerKey);

    // 3. 소셜 사용자 insert (ID 자동 생성 옵션 포함)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    @Insert("""
        INSERT INTO member(regdate, updatedate, loginid, loginpw, name, email, countryid, provider, provider_key, nickname, nicknameupdatedat)
        VALUES (NOW(), NOW(), #{loginId}, #{loginPw}, #{name}, #{email}, #{countryId}, #{provider}, #{providerKey}, #{nickname}, NOW())
    """)
    void insertSocial(Member member);

    // 4. 이메일 조회
    @Select("""
        SELECT *
        FROM member
        WHERE email = #{email}
    """)
    Member findByEmail(@Param("email") String email);

    // 5. 로그인아이디 조회
    @Select("""
        SELECT *
        FROM member
        WHERE loginid = #{loginId}
    """)
    Member findByLoginId(String loginId);

    // 6. ID로 조회
    @Select("""
        SELECT *
        FROM member
        WHERE id = #{id}
    """)
    Member findById(Integer id);

    // 7. 국가 목록
    @Select("""
        SELECT *
        FROM country
        ORDER BY id ASC
    """)
    List<Country> countries();

    // 8. 아이디 찾기
    @Select("""
        SELECT loginid
        FROM member
        WHERE name = #{name}
          AND email = #{email}
    """)
    String findLoginIdByNameAndEmail(@Param("name") String name, @Param("email") String email);

    // 9. 비밀번호 찾기 검증용
    @Select("""
        SELECT *
        FROM member
        WHERE loginid = #{loginId}
          AND email = #{email}
    """)
    Member findByLoginIdAndEmail(@Param("loginId") String loginId, @Param("email") String email);

    // 10. 비밀번호 재설정
    @Update("""
        UPDATE member
        SET loginpw = #{tempPw},
            updatedate = NOW()
        WHERE id = #{id}
    """)
    void updatePassword(@Param("id") Integer id, @Param("tempPw") String tempPw);

    // 11. 회원 정보 수정 (test3의 고도화된 로직 채택)
    // 값이 넘어온 경우에만 수정하고, null이나 빈 문자열은 기존 값을 유지합니다.
    @Update("""
        UPDATE member
        SET
            loginpw = COALESCE(NULLIF(#{member.loginPw}, ''), loginpw),
            updatedate = NOW(),
            name = COALESCE(NULLIF(#{member.name}, ''), name),
            email = COALESCE(NULLIF(#{member.email}, ''), email),
            countryid = COALESCE(#{member.countryId}, countryid),
            nickname = COALESCE(NULLIF(#{member.nickname}, ''), nickname),
            nicknameupdatedat = COALESCE(NULLIF(#{member.nicknameUpdatedAt}, '')::timestamp, nicknameupdatedat),
            profile_image_url = CASE
                WHEN #{member.resetProfileImage} = true THEN NULL
                ELSE COALESCE(NULLIF(#{member.profileImageUrl}, ''), profile_image_url)
            END
        WHERE id = #{id}
    """)
    void memberModify(@Param("member") Member member, @Param("id") int id);

    // 12. 회원 탈퇴
    @Delete("""
        DELETE FROM member
        WHERE id = #{id}
    """)
    void memberDelete(int id);

    // 13. 중복 체크 로직들
    @Select("""
        SELECT COUNT(*) > 0
        FROM member
        WHERE nickname = #{nickname}
    """)
    boolean existsByNickname(String nickname);

    @Select("""
        SELECT COUNT(*) > 0
        FROM member
        WHERE loginid = #{loginId}
    """)
    boolean existsByLoginId(String loginId);

    // 14. 해시되지 않은 비밀번호가 남아 있는 계정 (기동 시 1회 마이그레이션용)
    //     bcrypt 해시는 항상 "$2"로 시작한다.
    @Select("""
        SELECT id, loginid, loginpw, provider
        FROM member
        WHERE loginpw IS NULL OR loginpw NOT LIKE '$2%'
    """)
    List<Member> findWithLegacyPassword();

    // 15. 프로필 이미지 별도 업데이트
    @Update("""
        UPDATE member
        SET profile_image_url = #{url}
        WHERE id = #{memberId}
    """)
    void updateProfileImageUrl(@Param("memberId") int memberId, @Param("url") String url);
}