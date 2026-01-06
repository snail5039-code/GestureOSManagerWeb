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

INSERT INTO member (
    loginId, loginPw, name, email, countryId, role
) VALUES (
    'admin',
    'admin',
    '관리자',
    'admin@test.com',
    1,
    'ADMIN'
) ON CONFLICT (loginId) DO UPDATE SET 
    loginPw = EXCLUDED.loginPw,
    role = EXCLUDED.role,
    name = EXCLUDED.name;
