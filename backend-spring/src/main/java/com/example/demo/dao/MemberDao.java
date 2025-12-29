package com.example.demo.dao;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.example.demo.dto.Member;

@Mapper
public interface MemberDao {

    @Insert("""
        insert into member(regdate, updatedate, loginid, loginpw, name, email, countryid)
        values (now(), now(), #{loginId}, #{loginPw}, #{name}, #{email}, #{countryId})
    """)
    void join(Member member);

    @Select("""
        select *
        from member
        where loginid = #{loginId}
    """)
    Member findByLoginId(String loginId);

    @Select("""
        select *
        from member
        where loginid = #{loginId}
          and loginpw = #{loginPw}
    """)
    Member findByLoginIdAndPw(Member member);
    
    

    @Select("""
        select *
        from member
        where provider = #{provider}
          and email = #{email}
    """)
    Member findByProviderAndEmail(@Param("provider") String provider,
                                  @Param("email") String email);

	@Insert("""
			insert into member(regdate, updatedate, loginid, loginpw, name, email, countryid, provider, provider_key)
			values (now(), now(), #{loginId}, '', #{name}, #{email}, #{countryId}, #{provider}, #{providerKey})
			""")
	void insertSocial(Member member);
	
	@Select("""
			select *
			from member
			where provider = #{provider}
			  and provider_key = #{providerKey}
			""")
	Member findByProviderAndKey(@Param("provider") String provider, @Param("providerKey") String providerKey);

	@Select("""
			select *
				from member
				where id = #{id}
			""")
	Member findById(@Param("id") Integer id);
}
