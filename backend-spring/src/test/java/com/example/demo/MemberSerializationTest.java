package com.example.demo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.example.demo.dto.Member;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Member 는 MemberDao 가 SELECT * 로 채우기 때문에 비밀번호 해시까지 담긴다.
 * 그 상태로 /api/members/me 응답에 실리면 안 된다.
 */
class MemberSerializationTest {

    private final ObjectMapper om = new ObjectMapper();

    @Test
    void responseNeverContainsPasswordOrProviderKey() throws Exception {
        Member m = new Member();
        m.setId(7);
        m.setLoginId("hong");
        m.setNickname("홍길동");
        m.setLoginPw("bcrypt-hash-placeholder");
        m.setProvider("KAKAO");
        m.setProviderKey("998877665544");

        String json = om.writeValueAsString(m);

        assertFalse(json.contains("loginPw"), "응답에 loginPw 필드가 있다");
        assertFalse(json.contains("bcrypt-hash-placeholder"), "응답에 비밀번호 해시 값이 있다");
        assertFalse(json.contains("providerKey"), "응답에 providerKey 필드가 있다");
        assertFalse(json.contains("998877665544"), "응답에 providerKey 값이 있다");

        // 화면에서 쓰는 값은 그대로 나가야 한다
        assertTrue(json.contains("hong"));
        assertTrue(json.contains("KAKAO"));
    }

    @Test
    void requestStillAcceptsPassword() throws Exception {
        // 회원가입/회원정보수정은 loginPw 를 받아야 하므로 역직렬화는 계속 동작해야 한다
        String body = "{\"loginId\":\"hong\",\"loginPw\":\"secret123\",\"name\":\"홍길동\"}";

        Member m = om.readValue(body, Member.class);

        assertEquals("secret123", m.getLoginPw());
        assertEquals("hong", m.getLoginId());
    }
}
