package com.example.demo.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dao.CountryDao;
import com.example.demo.dao.MemberDao;
import com.example.demo.dto.Country;
import com.example.demo.dto.Member;

@Service
public class MemberService {
	
	private MemberDao memberDao;
	private CountryDao countryDao;
	
	public MemberService(MemberDao memberDao, CountryDao countryDao) {
		this.memberDao = memberDao;
		this.countryDao = countryDao;
	}

	public void join(Member member) {
		
		if (member.getLoginId() == null || member.getLoginId().isBlank())
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "아이디 필수");
		
		if (member.getLoginPw() == null || member.getLoginPw().isBlank())
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호 필수");
		
		if (member.getEmail() == null || member.getEmail().isBlank())
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이메일 필수");
		
		if (member.getCountryId() == null)
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "국적 선택 필수");
		
		if (this.memberDao.findByLoginId(member.getLoginId()) != null)
			throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 존재하는 아이디");
		
		this.memberDao.join(member);
	}

	public Member login(String loginId, String loginPw) {
		
		Member m = this.memberDao.findByLoginId(loginId);
		
		if (m == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인 실패");
		}
		
		if (!m.getLoginPw().equals(loginPw)) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인 실패");
		}
		
		return m;
	}
	
	public List<Country> countries() {
		return countryDao.findAll();
	}
	
	public Member upsertSocialUser(String provider,  String email, String name, String providerKey) {
		Member m = this.memberDao.findByProviderAndKey(provider, providerKey);
		if (m != null) return m;
		
		Member nm = new Member();
		nm.setProvider(provider);
		nm.setProviderKey(providerKey);
		nm.setEmail(email);
		nm.setName(name);
		nm.setLoginId(provider + "_"  + providerKey);
		nm.setCountryId(1);
		
		this.memberDao.insertSocial(nm);
		
		return this.memberDao.findByProviderAndKey(provider, providerKey);
	}

	public Member findById(Integer id) {
		return this.memberDao.findById(id);
	}


}
