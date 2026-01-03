package com.example.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import org.springframework.http.HttpStatus;

import com.example.demo.dao.MemberDao;
import com.example.demo.dto.Country;
import com.example.demo.dto.Member;

@Service
public class MemberService {

    private final MemberDao memberDao;

    public MemberService(MemberDao memberDao) {
        this.memberDao = memberDao;
    }

    // 회원 가입
    public void join(Member member) {
    	if (member.getLoginId() == null || member.getLoginId().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "아이디 필수");
        if (member.getLoginPw() == null || member.getLoginPw().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호 필수");
        if (member.getEmail() == null || member.getEmail().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이메일 필수");
        if (member.getName() == null || member.getName().isBlank())
        	throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이름 필수");
        if (member.getCountryId() == null)
        	throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "국적 선택 필수");

        if (this.memberDao.findByLoginId(member.getLoginId()) != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 존재하는 아이디");

        this.memberDao.join(member);
    }

    // 로그인
    public Member login(String loginId, String loginPw) {
        Member m = this.memberDao.findByLoginId(loginId.trim());
        
        if (m == null || !m.getLoginPw().equals(loginPw.trim())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인 실패");
        }
        
        return m;
    }

    // 이메일로 사용자 찾기
    public Member findByEmail(String email) {
    	
        return this.memberDao.findByEmail(email);
    }

    // 소셜 로그인 사용자를 디비에 등록
    public Member upsertSocialUser(String provider, String email, String name, String providerKey) {
        
    	Member m = this.memberDao.findByProviderAndKey(provider, providerKey);
    	
        if (m != null) return m; // 이미 존재하면 리턴

        if (providerKey == null || providerKey.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "providerKey is required");

        String safeName = (name == null || name.isBlank())
                ? (provider.toUpperCase() + "_" + providerKey)
                : name;
        
        String safeEmail = (email == null || email.isBlank())
                ? (provider.toLowerCase() + "_" + providerKey + "@social.local")
                : email;

        // 소셜 로그인 사용자 정보 생성
        Member nm = new Member();
        nm.setProvider(provider);
        nm.setProviderKey(providerKey);
        nm.setEmail(safeEmail);
        nm.setName(safeName);
        nm.setLoginId(provider + "_" + providerKey);
        nm.setLoginPw("SOCIAL_LOGIN"); // 더미 비밀번호
        nm.setCountryId(1);
        
        this.memberDao.insertSocial(nm);
        
        return this.memberDao.findByProviderAndKey(provider, providerKey);
    }

	public Member findById(Integer id) {
		return this.memberDao.findById(id);
	}

	public List<Country> countries() {
		return this.memberDao.countries();
	}
	
	public void insertSocial(Member member) {
	    memberDao.insertSocial(member);
	}

	public Member findByProviderAndKey(String provider, String providerKey) {
	    return memberDao.findByProviderAndKey(provider, providerKey);
	}
}
