package com.example.demo.config;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 어떤 기능이 설정되지 않아 꺼져 있는지 기동 시 한 번 알려준다.
 *
 * <p>선택 설정값에 기본값을 주면 서버는 뜨지만, 무엇이 꺼졌는지 모르면
 * "왜 인증 메일이 안 오지"를 로그 없이 찾아야 한다. 그래서 목록을 남긴다.
 */
@Component
@Order(0)
public class StartupConfigReport implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(StartupConfigReport.class);

    /** 설정하지 않았을 때 들어가는 자리표시자. application.yml 의 기본값과 맞춰야 한다. */
    private static final String NOT_CONFIGURED = "not-configured";

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${app.openai.api-key:}")
    private String openAiKey;

    @Value("${kcisa.service-key:}")
    private String kcisaKey;

    @Value("${app.admin.initial-password:}")
    private String adminInitialPassword;

    @Value("${spring.security.oauth2.client.registration.google.client-id:}")
    private String googleClientId;

    @Value("${spring.security.oauth2.client.registration.kakao.client-id:}")
    private String kakaoClientId;

    @Value("${spring.security.oauth2.client.registration.naver.client-id:}")
    private String naverClientId;

    @Override
    public void run(ApplicationArguments args) {
        List<String> off = new ArrayList<>();

        if (blank(mailUsername)) off.add("메일(MAIL_USERNAME) — 인증코드/아이디찾기/비밀번호재설정이 503");
        if (blank(openAiKey)) off.add("AI 도움말(OPENAI_API_KEY)");
        if (blank(kcisaKey)) off.add("KCISA 연동(KCISA_SERVICE_KEY)");
        if (unset(googleClientId)) off.add("구글 로그인(OAUTH_GOOGLE_CLIENT_ID)");
        if (unset(kakaoClientId)) off.add("카카오 로그인(OAUTH_KAKAO_CLIENT_ID)");
        if (unset(naverClientId)) off.add("네이버 로그인(OAUTH_NAVER_CLIENT_ID)");

        if (off.isEmpty()) {
            log.info("[CONFIG] 선택 기능 모두 설정됨");
        } else {
            log.warn("[CONFIG] 설정이 없어 꺼진 기능 {}개 — 필요하면 .env.example 을 참고하세요:", off.size());
            for (String s : off) log.warn("[CONFIG]   - {}", s);
        }

        if (blank(adminInitialPassword)) {
            log.info("[CONFIG] ADMIN_INITIAL_PASSWORD 가 없어 admin 계정은 로그인 불가 상태입니다.");
        }
    }

    private static boolean blank(String v) {
        return v == null || v.isBlank();
    }

    private static boolean unset(String v) {
        return blank(v) || NOT_CONFIGURED.equals(v.trim());
    }
}
