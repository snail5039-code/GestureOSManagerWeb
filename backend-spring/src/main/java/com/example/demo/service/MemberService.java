package com.example.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.beans.factory.annotation.Value;

import com.example.demo.dao.MemberDao;
import com.example.demo.dao.ArticleDao;
import com.example.demo.dao.CommentDao;
import com.example.demo.dao.ReactionDao;
import com.example.demo.dao.EmailVerificationDao;
import com.example.demo.dto.Country;
import com.example.demo.dto.Member;
import com.example.demo.dto.MyPageData;

import jakarta.mail.internet.MimeMessage;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
public class MemberService {

	private final MemberDao memberDao;
	private final org.springframework.mail.javamail.JavaMailSender mailSender;
	private final ArticleDao articleDao;
	private final CommentDao commentDao;
	private final ReactionDao reactionDao;
	private final EmailVerificationDao emailVerificationDao;
	private final PasswordEncoder passwordEncoder;

	@Value("${spring.mail.username}")
	private String mailFrom;

	public MemberService(MemberDao memberDao, org.springframework.mail.javamail.JavaMailSender mailSender,
			ArticleDao articleDao, CommentDao commentDao, ReactionDao reactionDao,
			EmailVerificationDao emailVerificationDao, PasswordEncoder passwordEncoder) {
		this.memberDao = memberDao;
		this.mailSender = mailSender;
		this.articleDao = articleDao;
		this.commentDao = commentDao;
		this.reactionDao = reactionDao;
		this.emailVerificationDao = emailVerificationDao;
		this.passwordEncoder = passwordEncoder;
	}

	public boolean isNicknameTaken(String nickname) {
		return memberDao.existsByNickname(nickname);
	}

	public boolean isLoginIdTaken(String loginId) {
		return memberDao.existsByLoginId(loginId);
	}

	public MyPageData getMyPageData(int memberId) {
		Member member = memberDao.findById(memberId);
		if (member == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다.");
		}

		MyPageData data = new MyPageData();
		data.setMember(member);

		int articleCount = articleDao.countByMemberId(memberId);
		int commentCount = commentDao.countByMemberId(memberId);
		int likeCount = reactionDao.countArticleReactionsByMemberId(memberId);
		data.setStats(new MyPageData.Stats(articleCount, commentCount, likeCount));

		data.setMyArticles(articleDao.selectByMemberId(memberId));
		data.setMyComments(commentDao.selectByMemberId(memberId));
		data.setLikedArticles(articleDao.selectLikedByMemberId(memberId));

		java.time.LocalDateTime last = null;
		if (member.getNicknameUpdatedAt() != null) {
			try {
				last = java.time.LocalDateTime.parse(member.getNicknameUpdatedAt(),
						java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
			} catch (Exception e) {
				try {
					last = java.time.LocalDateTime.parse(member.getNicknameUpdatedAt());
				} catch (Exception ignored) {
				}
			}
		}

		java.time.LocalDateTime next = (last != null) ? last.plusDays(30) : null;
		boolean nicknameChangeAllowed = (next == null) || !next.isAfter(java.time.LocalDateTime.now());

		String nextNicknameChangeDate = (next != null)
				? next.format(java.time.format.DateTimeFormatter.ofPattern("yyyy년 MM월 dd일 HH시 mm분"))
				: "";

		long nicknameDaysLeft = 0;
		if (next != null && next.isAfter(java.time.LocalDateTime.now())) {
			nicknameDaysLeft = java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDateTime.now(), next);
			if (nicknameDaysLeft < 0)
				nicknameDaysLeft = 0;
		}

		data.setNicknameChangeAllowed(nicknameChangeAllowed);
		data.setNextNicknameChangeDate(nextNicknameChangeDate);
		data.setNicknameDaysLeft(nicknameDaysLeft);

		return data;
	}

	// ✅ 회원 가입 (중복 제거 + 6자리 검증 + BCrypt 저장)
	public void join(Member member) {
		if (member.getLoginId() == null || member.getLoginId().isBlank())
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "아이디를 입력해주세요.");
		if (member.getLoginPw() == null || member.getLoginPw().isBlank())
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호를 입력해주세요.");
		if (member.getEmail() == null || member.getEmail().isBlank())
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이메일을 입력해주세요.");
		if (member.getName() == null || member.getName().isBlank())
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이름을 입력해주세요.");
		if (member.getCountryId() == null)
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "국적을 선택해주세요.");

		if (this.memberDao.findByLoginId(member.getLoginId()) != null)
			throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 존재하는 아이디입니다.");

		if (!emailVerificationDao.isEmailVerified(member.getEmail())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이메일 인증이 필요합니다.");
		}

		// ✅ 비밀번호 정책 + 해시 저장
		validatePasswordOrThrow(member.getLoginPw());
		String raw = member.getLoginPw().trim();
		member.setLoginPw(passwordEncoder.encode(raw));

		this.memberDao.join(member);

		// ✅ 가입 완료 후 인증정보 삭제
		emailVerificationDao.deleteByEmail(member.getEmail());
	}

	// ✅ 로그인 (bcrypt + 평문 마이그레이션)
	public Member login(String loginId, String loginPw) {
		Member m = this.memberDao.findByLoginId(loginId.trim());
		if (m == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다.");
		}

		String raw = loginPw.trim();
		String stored = m.getLoginPw();

		boolean ok;

		if (stored != null && stored.startsWith("$2")) {
			ok = passwordEncoder.matches(raw, stored);
		} else {
			ok = (stored != null && stored.equals(raw));

			if (ok) {
				String hashed = passwordEncoder.encode(raw);
				memberDao.updatePassword(m.getId(), hashed);
				m.setLoginPw(hashed);
			}
		}

		if (!ok) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다.");
		}

		return m;
	}

	public Member findByEmail(String email) {
		return this.memberDao.findByEmail(email);
	}

	public Member upsertSocialUser(String provider, String email, String name, String providerKey) {
		Member m = this.memberDao.findByProviderAndKey(provider, providerKey);
		if (m != null)
			return m;

		if (providerKey == null || providerKey.isBlank())
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "providerKey is required");

		String safeName = (name == null || name.isBlank()) ? (provider.toUpperCase() + "_" + providerKey) : name;

		String safeEmail = (email == null || email.isBlank())
				? (provider.toLowerCase() + "_" + providerKey + "@social.local")
				: email;

		Member nm = new Member();
		nm.setProvider(provider);
		nm.setProviderKey(providerKey);
		nm.setEmail(safeEmail);
		nm.setName(safeName);
		nm.setLoginId(provider + "_" + providerKey);
		nm.setLoginPw("SOCIAL_LOGIN");
		nm.setCountryId(1);
		nm.setNickname(safeName);

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

	public void findLoginIdByNameAndEmail(String name, String email) {
		String loginId = memberDao.findLoginIdByNameAndEmail(name, email);
		if (loginId == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "일치하는 회원이 없습니다.");
		}
		sendLoginIdEmail(email, loginId);
	}

	// ✅ 비밀번호 재설정 (DB에는 해시, 메일은 원문)
	public void resetPasswordWithEmail(String loginId, String email) {
		Member member = memberDao.findByLoginIdAndEmail(loginId, email);

		if (member == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "일치하는 회원이 없습니다.");
		}

		String tempPw = UUID.randomUUID().toString().substring(0, 8);

		String hashed = passwordEncoder.encode(tempPw);
		memberDao.updatePassword(member.getId(), hashed);

		sendTempPasswordEmail(email, tempPw);
	}

	// ===== 메일 공통 =====

	private void sendLoginIdEmail(String to, String loginId) {
		String subject = "[Gesture OS Manager] 아이디 안내";
		String body = """
				<html>
				  <body>
				    <h3>아이디 안내</h3>
				    <p>회원님의 아이디는 <b>%s</b> 입니다.</p>
				    <a href="http://localhost:5174/login">로그인 하러가기</a>
				  </body>
				</html>
				""".formatted(loginId);

		sendEmail(to, subject, body);
	}
	// 나중에 주소 도메인 넣어야함 ㅇㅋ?
	private void sendTempPasswordEmail(String to, String tempPw) {
		String subject = "[Gesture OS Manager] 임시 비밀번호 안내";
		String body = """
				<html>
				  <body>
				    <h3>임시 비밀번호 안내</h3>
				    <p>임시 비밀번호는 <b>%s</b> 입니다.</p>
				    <p>로그인 후 즉시 비밀번호를 변경해주세요.</p>
				    <a href="http://localhost:5174/login">로그인 하러가기</a>
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
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "메일 발송 중 오류가 발생했습니다.");
		}
	}

	public void memberModify(Member member, int id) {
		System.out.println("[MemberService] memberModify id=" + id + ", member=" + member);

		Member oldMember = memberDao.findById(id);
		if (oldMember == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다.");
		}

		// ===== 1) 누락 필드 머지 =====
		if (member.getName() == null || member.getName().isBlank()) {
			member.setName(oldMember.getName());
		}

		if (member.getEmail() == null || member.getEmail().isBlank()) {
			member.setEmail(oldMember.getEmail());
		}

		if (member.getCountryId() == null) {
			member.setCountryId(oldMember.getCountryId());
		}

		// nickname (빈 문자열이면 null로 -> DAO에서 COALESCE/NULLIF 처리 가정)
		if (member.getNickname() != null && member.getNickname().isBlank()) {
			member.setNickname(null);
		}

		// ✅✅✅ profile image url: resetProfileImage=true면 NULL로 강제 세팅 (null-safe)
		boolean reset = Boolean.TRUE.equals(member.getResetProfileImage());
		if (reset) {
			member.setProfileImageUrl(null);
		} else {
			if (member.getProfileImageUrl() == null || member.getProfileImageUrl().isBlank()) {
				member.setProfileImageUrl(oldMember.getProfileImageUrl());
			}
		}

		// ===== 2) 비밀번호 =====
		if (member.getLoginPw() == null || member.getLoginPw().isBlank()) {
			member.setLoginPw(oldMember.getLoginPw());
		} else {
			validatePasswordOrThrow(member.getLoginPw());
			String raw = member.getLoginPw().trim();
			member.setLoginPw(passwordEncoder.encode(raw));
		}

		// ===== 3) 닉네임 변경 30일 제한 =====
		String nextNickname = member.getNickname();
		String oldNickname = oldMember.getNickname();

		if (nextNickname != null && !nextNickname.equals(oldNickname)) {
			java.time.LocalDateTime last = null;

			if (oldMember.getNicknameUpdatedAt() != null) {
				try {
					last = java.time.LocalDateTime.parse(oldMember.getNicknameUpdatedAt(),
							java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
				} catch (Exception e) {
					try {
						last = java.time.LocalDateTime.parse(oldMember.getNicknameUpdatedAt());
					} catch (Exception ignored) {
					}
				}
			}

			if (last != null && last.plusDays(30).isAfter(java.time.LocalDateTime.now())) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "닉네임은 30일에 한 번만 변경 가능합니다.");
			}

			member.setNicknameUpdatedAt(java.time.LocalDateTime.now()
					.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
		} else {
			member.setNickname(oldNickname);
			member.setNicknameUpdatedAt(oldMember.getNicknameUpdatedAt());
		}

		// ===== 4) DB 업데이트 =====
		try {
			memberDao.memberModify(member, id);
		} catch (Exception e) {
			e.printStackTrace();
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
					"회원 정보 수정 중 오류가 발생했습니다: " + e.getMessage());
		}
	}

	public void memberDelete(int id) {
		this.memberDao.memberDelete(id);
	}

	// --- 이메일 인증 관련 ---

	public void sendVerificationCode(String email) {
		String code = String.valueOf((int) (Math.random() * 899999) + 100000);
		java.time.LocalDateTime expiredAt = java.time.LocalDateTime.now().plusMinutes(5);

		emailVerificationDao.deleteByEmail(email);
		emailVerificationDao.insertVerification(email, code, expiredAt);

		String subject = "[SLT Project] 이메일 인증 코드 안내";
		String body = """
				<html>
				  <body>
				    <h3>이메일 인증 코드</h3>
				    <p>인증 코드는 <b>%s</b> 입니다.</p>
				    <p>5분 이내에 입력해주세요.</p>
				  </body>
				</html>
				""".formatted(code);

		sendEmail(email, subject, body);
	}

	public void verifyCode(String email, String code) {
		if (emailVerificationDao.isValidCode(email, code)) {
			emailVerificationDao.markAsVerified(email, code);
		} else {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "인증 코드가 올바르지 않거나 만료되었습니다.");
		}
	}

	// ✅ 프로필 이미지 업로드 + DB URL 업데이트
	public String updateProfileImage(int memberId, MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "파일이 비어있음");
		}
		if (file.getContentType() == null || !file.getContentType().startsWith("image/")) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지 파일만 업로드 가능");
		}
		long maxBytes = 3L * 1024 * 1024;
		if (file.getSize() > maxBytes) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "3MB 이하만 업로드 가능");
		}

		try {
			Path baseDir = Paths.get("uploads", "profile", String.valueOf(memberId)).toAbsolutePath().normalize();
			Files.createDirectories(baseDir);

			String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
			String ext = "";
			int dot = original.lastIndexOf(".");
			if (dot >= 0)
				ext = original.substring(dot).toLowerCase();

			if (ext.isBlank()) {
				String ct = file.getContentType();
				if ("image/png".equals(ct))
					ext = ".png";
				else if ("image/jpeg".equals(ct))
					ext = ".jpg";
				else if ("image/webp".equals(ct))
					ext = ".webp";
				else
					ext = ".png";
			}

			String filename = UUID.randomUUID().toString().replace("-", "") + ext;
			Path target = baseDir.resolve(filename);
			Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

			String url = "/uploads/profile/" + memberId + "/" + filename;

			memberDao.updateProfileImageUrl(memberId, url);

			return url;
		} catch (Exception e) {
			e.printStackTrace();
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "업로드 실패");
		}
	}

	// ✅ 비밀번호 정책: 6자리 이상
	private void validatePasswordOrThrow(String rawPw) {
		if (rawPw == null)
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호는 필수입니다.");
		String pw = rawPw.trim();
		if (pw.length() < 6) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호는 6자리 이상이어야 합니다.");
		}
	}
}
