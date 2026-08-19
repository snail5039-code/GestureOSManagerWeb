-- 초기 데이터 삽입
INSERT INTO board (id, boardName) VALUES
  (1, '공지사항'),
  (2, '자유게시판'),
  (3, '질문과 답변'),
  (4, '오류사항 접수')
ON CONFLICT (id) DO NOTHING;

INSERT INTO country (id, countryName) VALUES
  (1, '한국'),
  (2, '미국'),
  (3, '일본')
ON CONFLICT (id) DO NOTHING;

-- 관리자 계정.
-- loginPw 는 '!' = bcrypt 해시가 아니므로 어떤 비밀번호로도 로그인되지 않는 상태다.
-- 실제 비밀번호는 app.admin.initial-password (환경변수 ADMIN_INITIAL_PASSWORD) 로 주면
-- 기동 시 LegacyPasswordMigration 이 한 번만 채운다.
--
-- 예전에는 여기에 평문 'admin' 이 들어 있었고, DO UPDATE 가 loginPw 까지 덮어써서
-- 서버를 재시작할 때마다 admin/admin 으로 되돌아갔다. 그래서 loginPw 는 갱신 대상에서 뺐다.
-- (닉네임/닉네임 변경일도 함께 뺐다 — 매 부팅마다 30일 변경 제한이 초기화되던 문제)
INSERT INTO member (
    loginId, loginPw, name, email, countryId, role, nickname, nicknameUpdatedAt
) VALUES (
    'admin',
    '!',
    '관리자',
    'admin@test.com',
    1,
    'ADMIN',
    '관리자',
    NOW()
) ON CONFLICT (loginId) DO UPDATE SET
    role = EXCLUDED.role,
    name = EXCLUDED.name;
