create table if not exists country (
    id bigserial primary key,
    countryName varchar(200) not null
);

create table if not exists member (
    id bigserial primary key,
    loginId varchar(200) unique not null,
    loginPw varchar(200) not null,
    regDate timestamp not null default now(),
    updateDate timestamp not null default now(),
    name varchar(100) not null,
    email text not null,
    countryId bigint not null,
    nickname varchar(100) unique,
    nicknameUpdatedAt timestamp
);

create table if not exists board (
    id bigserial primary key,
    boardName varchar(100) not null
);

create table if not exists article (
    id bigserial primary key,
    title varchar(200) not null,
    content text not null,
    regDate timestamp not null default now(),
    updateDate timestamp not null default now(),
    boardId bigint not null,
    memberId bigint not null,
    hit integer not null default 0
);

ALTER TABLE article ADD COLUMN IF NOT EXISTS hit integer NOT NULL DEFAULT 0;

ALTER TABLE member ADD COLUMN IF NOT EXISTS provider varchar(20);
ALTER TABLE member ADD COLUMN IF NOT EXISTS provider_key varchar(100);
ALTER TABLE member ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'USER';
ALTER TABLE member ADD COLUMN IF NOT EXISTS nickname varchar(100) unique;
ALTER TABLE member ADD COLUMN IF NOT EXISTS nicknameUpdatedAt timestamp;

-- Unique Index for Social Login
CREATE UNIQUE INDEX IF NOT EXISTS member_provider_provider_key_uq ON member(provider, provider_key);

create table if not exists refresh_tokens (
  member_id integer primary key,
  token text not null,
  updated_at timestamp not null default now()
);

-- Index for Refresh Tokens
CREATE INDEX IF NOT EXISTS idx_refresh_token_token on refresh_tokens(token);

CREATE TABLE IF NOT EXISTS comment (
    id BIGSERIAL PRIMARY KEY,
    relTypeCode VARCHAR(50) NOT NULL,
    relId BIGINT NOT NULL,
    memberId BIGINT NOT NULL,
    content TEXT NOT NULL,
    parentId BIGINT,
    regDate TIMESTAMP NOT NULL DEFAULT NOW(),
    updateDate TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_comment_member FOREIGN KEY (memberId) REFERENCES member(id),
    CONSTRAINT fk_comment_parent FOREIGN KEY (parentId) REFERENCES comment(id) ON DELETE CASCADE
);

-- Indexes for Comments
CREATE INDEX IF NOT EXISTS idx_comment_rel ON comment(relTypeCode, relId);
CREATE INDEX IF NOT EXISTS idx_comment_parent ON comment(parentId);

CREATE TABLE IF NOT EXISTS reaction (
    id BIGSERIAL PRIMARY KEY,
    relTypeCode VARCHAR(50) NOT NULL,
    relId BIGINT NOT NULL,
    memberId BIGINT NOT NULL,
    regDate TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT reaction_unique UNIQUE (relTypeCode, relId, memberId),
    CONSTRAINT fk_reaction_member FOREIGN KEY (memberId) REFERENCES member(id)
);

-- Indexes for Reactions
CREATE INDEX IF NOT EXISTS idx_reaction_rel ON reaction(relTypeCode, relId);

CREATE TABLE IF NOT EXISTS email_verification (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expired_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    regDate TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_email ON email_verification(email);


ALTER TABLE member
ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500);

-- ============================================================
-- QnA(질문과 답변) 고정글 10개 (ko) - 부팅 시 항상 동일하게 유지
-- boardId = 3, admin memberId = 4
-- ============================================================

-- 1) 고정글 컬럼(없으면 생성)
ALTER TABLE article
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

ALTER TABLE article
  ADD COLUMN IF NOT EXISTS pinned_order integer;

ALTER TABLE article
  ADD COLUMN IF NOT EXISTS lang varchar(5) NOT NULL DEFAULT 'ko';

-- 2) 중복 방지 유니크 인덱스(없으면 생성)
CREATE UNIQUE INDEX IF NOT EXISTS uq_article_qna_pin
ON article (boardId, lang, pinned_order)
WHERE is_pinned = true;

-- 3) 기존 QnA 고정글(ko) 제거 후 재삽입
DELETE FROM article
WHERE boardId = 3
  AND lang = 'ko'
  AND is_pinned = true;

INSERT INTO article (title, content, boardId, memberId, hit, is_pinned, pinned_order, lang)
VALUES
('Gesture OS Manager는 어떤 서비스인가요?',
'Gesture OS Manager는 손 제스처로 PC를 더 편하게 제어할 수 있도록 돕는 서비스입니다.
웹(Manager)에서 설정을 관리하고, 실행 프로그램(Agent)이 실제 제스처 인식/동작을 수행합니다.',
3, 4, 0, true, 1, 'ko'),

('처음 설치/실행은 어떻게 하나요?',
'1) 다운로드 페이지에서 최신 설치 파일을 받습니다.
2) 설치 후 실행 프로그램(Agent)을 먼저 실행합니다.
3) 웹(Manager)에 로그인 후 연결 상태를 확인합니다.
문제가 있으면 “오류사항 접수” 게시판에 환경 정보와 함께 남겨주세요.',
3, 4, 0, true, 2, 'ko'),

('로그인 없이 사용할 수 있나요?',
'일부 기능은 로그인 없이도 안내를 볼 수 있지만, 설정 저장/개인화 기능은 로그인이 필요합니다.
소셜 로그인(구글 등)을 지원합니다.',
3, 4, 0, true, 3, 'ko'),

('소셜 로그인 후 화면이 이상하게 이동하거나 로그인이 풀려요',
'브라우저 팝업 차단/쿠키 정책/리다이렉트 환경에 따라 발생할 수 있습니다.
다른 브라우저로 시도하거나, 팝업/서드파티 쿠키 허용 후 다시 로그인해 주세요.
지속되면 오류사항 접수에 “사용 브라우저/OS/발생 화면”을 남겨주세요.',
3, 4, 0, true, 4, 'ko'),

('카메라가 인식이 안 되거나 화면이 검게 나와요',
'윈도우/브라우저에서 카메라 권한이 꺼져있거나, 다른 앱이 카메라를 사용 중일 수 있습니다.
설정에서 권한을 켜고, Zoom/Discord 등 카메라 사용하는 앱을 종료한 뒤 다시 시도해 주세요.',
3, 4, 0, true, 5, 'ko'),

('제스처 인식이 잘 안 돼요(잘못 인식/끊김)',
'조명과 거리의 영향이 큽니다.
손을 화면 중앙에 두고, 너무 가까이 대지 말고, 밝은 환경에서 천천히 움직여 주세요.
배경이 복잡하면 인식이 떨어질 수 있습니다.',
3, 4, 0, true, 6, 'ko'),

('커서/동작이 떨리거나 지연돼요',
'PC 성능/카메라 품질/동시 실행 프로그램에 따라 지연이 생길 수 있습니다.
불필요한 프로그램을 종료하고, 카메라 해상도/프레임을 낮추면 개선될 수 있습니다.',
3, 4, 0, true, 7, 'ko'),

('연결 상태가 OFFLINE/연결 안 됨으로 떠요',
'실행 프로그램(Agent)이 켜져 있는지 먼저 확인해 주세요.
그래도 안 되면 방화벽/보안 프로그램이 통신을 막고 있을 수 있습니다.
오류사항 접수에 “OFFLINE 화면 캡처 + OS + 네트워크 환경”을 남겨주세요.',
3, 4, 0, true, 8, 'ko'),

('개인정보는 어떻게 처리되나요? (카메라 영상 저장되나요?)',
'서비스는 제스처 인식을 위해 카메라 입력을 사용하지만, 원본 영상 자체를 저장/업로드하지 않도록 설계되었습니다.
다만 일부 로그/설정 정보는 서비스 품질 개선을 위해 저장될 수 있습니다.',
3, 4, 0, true, 9, 'ko'),

('문제가 생기면 어디에 문의하면 되나요?',
'질문은 “질문과 답변(QnA)”에 남겨주시면 안내드립니다.
버그/오류 제보는 “오류사항 접수” 게시판에 아래 정보를 함께 남겨주세요:
- OS(윈도우 버전)
- 브라우저(크롬/엣지 등)
- 카메라 종류
- 발생 화면 캡처/재현 방법',
3, 4, 0, true, 10, 'ko');