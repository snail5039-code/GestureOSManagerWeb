package com.example.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.MimeMessageHelper;

import com.example.demo.dao.MemberDao;
import com.example.demo.dao.ArticleDao;
import com.example.demo.dao.CommentDao;
import com.example.demo.dao.ReactionDao;
import com.example.demo.dto.Country;
import com.example.demo.dto.Member;
import com.example.demo.dto.MyPageData;

import jakarta.mail.internet.MimeMessage;

@Service
public class MemberService {

    private final MemberDao memberDao;
    private final org.springframework.mail.javamail.JavaMailSender mailSender;
    private final ArticleDao articleDao;
    private final CommentDao commentDao;
    private final ReactionDao reactionDao;

    @org.springframework.beans.factory.annotation.Value("${spring.mail.username}")
    private String mailFrom;

    public MemberService(MemberDao memberDao,
            org.springframework.mail.javamail.JavaMailSender mailSender,
            ArticleDao articleDao,
            CommentDao commentDao,
            ReactionDao reactionDao) {
        this.memberDao = memberDao;
        this.mailSender = mailSender;
        this.articleDao = articleDao;
        this.commentDao = commentDao;
        this.reactionDao = reactionDao;
    }

    public MyPageData getMyPageData(int memberId) {
        Member member = memberDao.findById(memberId);
        if (member == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다.");
        }

        MyPageData data = new MyPageData();
        data.setMember(member);

        // 통계
        int articleCount = articleDao.countByMemberId(memberId);
        int commentCount = commentDao.countByMemberId(memberId);
        int likeCount = reactionDao.countArticleReactionsByMemberId(memberId);
        data.setStats(new MyPageData.Stats(articleCount, commentCount, likeCount));

        // 목록
        data.setMyArticles(articleDao.selectByMemberId(memberId));
        data.setMyComments(commentDao.selectByMemberId(memberId));
        data.setLikedArticles(articleDao.selectLikedByMemberId(memberId));

        return data;
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

        if (m != null)
            return m; // 이미 존재하면 리턴

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

    // 아이디 찾기
    public void findLoginIdByNameAndEmail(String name, String email) {
        String loginId = memberDao.findLoginIdByNameAndEmail(name, email);

        if (loginId == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "일치하는 회원이 없습니다.");
        }

        sendLoginIdEmail(email, loginId);
    }

    // 비밀번호 재설정 + 이메일 발송
    public void resetPasswordWithEmail(String loginId, String email) {
        Member member = memberDao.findByLoginIdAndEmail(loginId, email);

        if (member == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "일치하는 회원이 없습니다.");
        }

        // 임시 비밀번호 생성
        String tempPw = UUID.randomUUID().toString().substring(0, 8);

        // DB 업데이트
        memberDao.updatePassword(member.getId(), tempPw);

        // 메일 발송
        sendTempPasswordEmail(email, tempPw);
    }

    // ===== 메일 공통 =====

    private void sendLoginIdEmail(String to, String loginId) {
        String subject = "[SLT Project] 아이디 안내";
        String body = """
                    <html>
                      <body>
                        <h3>아이디 안내</h3>
                        <p>회원님의 아이디는 <b>%s</b> 입니다.</p>
                        <a href="http://localhost:5173/login">로그인 하러가기</a>
                      </body>
                    </html>
                """.formatted(loginId);

        sendEmail(to, subject, body);
    }

    private void sendTempPasswordEmail(String to, String tempPw) {
        String subject = "[SLT Project] 임시 비밀번호 안내";
        String body = """
                    <html>
                      <body>
                        <h3>임시 비밀번호 안내</h3>
                        <p>임시 비밀번호는 <b>%s</b> 입니다.</p>
                        <p>로그인 후 즉시 비밀번호를 변경해주세요.</p>
                        <a href="http://localhost:5173/login">로그인 하러가기</a>
                      </body>
                    </html>
                """.formatted(tempPw);

        sendEmail(to, subject, body);
    }

    private void sendEmail(String to, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            helper.setFrom(mailFrom);

            mailSender.send(message);
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "메일 발송 중 오류가 발생했습니다.");
        }
    }

	public void memberModify(Member member, int id) {
		this.memberDao.memberModify(member, id);
		
	}

	public void memberDelete(int id) {
		this.memberDao.memberDelete(id);
		
	}



}