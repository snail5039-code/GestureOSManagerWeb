package com.example.demo.config;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.example.demo.dao.MemberDao;
import com.example.demo.dto.Member;

/**
 * 기동 시 1회, 해시되지 않은 비밀번호를 정리한다.
 *
 * <p>예전 로그인 로직에는 "저장값이 bcrypt 해시가 아니면 평문으로 비교한다"는 마이그레이션 경로가
 * 있었다. 그 경로 때문에 소셜 계정의 고정 비밀번호("SOCIAL_LOGIN")와 시드 관리자 계정(admin/admin)으로
 * 로그인이 가능했다. 평문 비교를 없애는 대신, 남아 있는 평문 비밀번호를 여기서 해시로 옮긴다.
 *
 * <ul>
 *   <li>소셜 계정 → 아무도 모르는 랜덤 해시 (비밀번호 로그인 불가)</li>
 *   <li>널리 알려진 약한 시드 비밀번호 → {@link #UNUSABLE_PASSWORD} (로그인 불가, 재설정 필요)</li>
 *   <li>그 외 평문 → 같은 비밀번호의 bcrypt 해시 (사용자는 그대로 로그인 가능)</li>
 * </ul>
 */
@Component
public class LegacyPasswordMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LegacyPasswordMigration.class);

    /** bcrypt 형식이 아니므로 어떤 입력과도 일치하지 않는 값 = 로그인 불가 상태. */
    public static final String UNUSABLE_PASSWORD = "!";

    /** 소스/시드에 그대로 적혀 있어 사실상 공개된 비밀번호는 해시로 옮기지 않고 무효화한다. */
    private static final Set<String> KNOWN_WEAK = Set.of(
            "admin", "test", "guest", "user",
            "1234", "12345", "123456", "1234567", "12345678",
            "password", "qwerty", "social_login");

    private final MemberDao memberDao;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.initial-password:}")
    private String adminInitialPassword;

    public LegacyPasswordMigration(MemberDao memberDao, PasswordEncoder passwordEncoder) {
        this.memberDao = memberDao;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<Member> legacy;
        try {
            legacy = memberDao.findWithLegacyPassword();
        } catch (Exception e) {
            // DB 가 아직 준비되지 않은 개발 환경에서 기동 자체를 막지는 않는다.
            log.warn("[MIGRATION] 비밀번호 점검을 건너뜁니다 (DB 조회 실패): {}", e.getMessage());
            return;
        }

        int hashed = 0;
        int social = 0;
        int disabled = 0;

        for (Member m : legacy) {
            if (m.getId() == null) continue;

            String stored = m.getLoginPw() == null ? "" : m.getLoginPw().trim();

            // 이미 로그인 불가 마커인 계정은 손대지 않는다.
            // (이걸 빼먹으면 매 부팅마다 마커를 해시해서 "!" 가 실제 비밀번호가 되어버린다)
            if (UNUSABLE_PASSWORD.equals(stored)) {
                continue;
            }

            if (m.getProvider() != null && !m.getProvider().isBlank()) {
                memberDao.updatePassword(m.getId(), passwordEncoder.encode(UUID.randomUUID().toString()));
                social++;
            } else if (stored.isEmpty() || KNOWN_WEAK.contains(stored.toLowerCase())) {
                memberDao.updatePassword(m.getId(), UNUSABLE_PASSWORD);
                disabled++;
            } else {
                memberDao.updatePassword(m.getId(), passwordEncoder.encode(stored));
                hashed++;
            }
        }

        if (hashed + social + disabled > 0) {
            log.info("[MIGRATION] 비밀번호 정리 완료 — 해시 전환 {}건, 소셜 계정 {}건, 무효화 {}건",
                    hashed, social, disabled);
        }
        if (disabled > 0) {
            log.warn("[MIGRATION] 공개된 약한 비밀번호를 쓰던 계정 {}건을 로그인 불가로 바꿨습니다. "
                    + "'비밀번호 찾기'로 재설정해야 합니다.", disabled);
        }

        applyAdminInitialPassword();
    }

    /**
     * 시드로 만들어지는 admin 계정은 비밀번호가 없는(로그인 불가) 상태로 들어온다.
     * app.admin.initial-password (환경변수 ADMIN_INITIAL_PASSWORD) 가 있으면 그 값으로 한 번만 채운다.
     * 이미 비밀번호가 설정되어 있으면 건드리지 않는다 — 재시작마다 초기화되면 안 되기 때문.
     */
    private void applyAdminInitialPassword() {
        String pw = adminInitialPassword == null ? "" : adminInitialPassword.trim();
        if (pw.isEmpty()) return;

        if (pw.length() < 8) {
            log.error("[INIT] app.admin.initial-password 는 8자 이상이어야 합니다. 무시합니다.");
            return;
        }

        Member admin;
        try {
            admin = memberDao.findByLoginId("admin");
        } catch (Exception e) {
            log.warn("[INIT] admin 계정 조회 실패: {}", e.getMessage());
            return;
        }
        if (admin == null || admin.getId() == null) return;

        String stored = admin.getLoginPw() == null ? "" : admin.getLoginPw().trim();
        if (!UNUSABLE_PASSWORD.equals(stored) && !stored.isEmpty()) {
            log.info("[INIT] admin 계정에 이미 비밀번호가 있어 초기 비밀번호를 적용하지 않았습니다.");
            return;
        }

        memberDao.updatePassword(admin.getId(), passwordEncoder.encode(pw));
        log.info("[INIT] admin 계정 비밀번호를 app.admin.initial-password 값으로 설정했습니다.");
    }
}
