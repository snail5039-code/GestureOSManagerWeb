package com.example.demo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

import com.example.demo.service.MemberService;

/**
 * 프로필 이미지 업로드가 "파일 내용"으로 확장자를 정하는지 확인한다.
 * 원본 파일명이나 Content-Type 을 믿으면 마크업 파일이 /uploads 로 올라가 실행될 수 있고,
 * 파일명에 상위 경로 문자가 섞이면 업로드 폴더 밖으로 쓰기가 가능해진다.
 */
class UploadedImageTypeTest {

    private String detect(byte[] bytes) throws Exception {
        Method m = MemberService.class.getDeclaredMethod("detectImageExtension", byte[].class);
        m.setAccessible(true);
        return (String) m.invoke(null, (Object) bytes);
    }

    private byte[] pad(byte[] head) {
        byte[] out = new byte[16];
        System.arraycopy(head, 0, out, 0, head.length);
        return out;
    }

    private byte[] ascii(String s) {
        return s.getBytes(StandardCharsets.US_ASCII);
    }

    @Test
    void detectsRealImageSignatures() throws Exception {
        assertEquals("png", detect(pad(new byte[] {
                (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A })));
        assertEquals("jpg", detect(pad(new byte[] {
                (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0 })));
        assertEquals("gif", detect(pad(ascii("GIF89a"))));
        assertEquals("gif", detect(pad(ascii("GIF87a"))));
        assertEquals("webp", detect(ascii("RIFF    WEBPVP8 ")));
    }

    @Test
    void rejectsMarkupAndTextFiles() throws Exception {
        // 예전 코드는 파일명 확장자를 그대로 썼기 때문에 이런 파일이 그대로 저장될 수 있었다.
        assertNull(detect(ascii("<html><head>hello</head>")));
        assertNull(detect(ascii("<svg width=\"10\" height=\"10\">")));
        assertNull(detect(ascii("just a text file, not an image")));
        // RIFF 컨테이너지만 WEBP 가 아닌 경우(오디오)도 거부한다.
        assertNull(detect(ascii("RIFF    WAVEfmt ")));
    }

    @Test
    void rejectsEmptyOrTruncated() throws Exception {
        assertNull(detect(null));
        assertNull(detect(new byte[0]));
        assertNull(detect(new byte[] { (byte) 0x89, 'P', 'N', 'G' }));
    }

    @Test
    void extensionCannotCarryPathCharacters() throws Exception {
        // 판별 결과는 고정된 소문자 토큰뿐이라 파일명 조작이 불가능하다.
        String ext = detect(pad(new byte[] { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A }));
        assertEquals("png", ext);
        assertEquals(-1, ext.indexOf('/'));
        assertEquals(-1, ext.indexOf((char) 92)); // 역슬래시
        assertEquals(-1, ext.indexOf('.'));
    }
}
