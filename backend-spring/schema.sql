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
    countryId bigint not null
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
    memberId bigint not null
);

ALTER TABLE member ADD COLUMN IF NOT EXISTS provider varchar(20);
ALTER TABLE member ADD COLUMN IF NOT EXISTS provider_key varchar(100);
ALTER TABLE member ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'USER';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'member_provider_provider_key_uq') THEN
        CREATE UNIQUE INDEX member_provider_provider_key_uq ON member(provider, provider_key);
    END IF;
END $$;

create table if not exists refresh_tokens (
  member_id integer primary key,
  token text not null,
  updated_at timestamp not null default now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_refresh_token_token') THEN
        create index idx_refresh_token_token on refresh_tokens(token);
    END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS comment (
    id BIGSERIAL PRIMARY KEY,
    articleId BIGINT NOT NULL,
    memberId BIGINT NOT NULL,
    content TEXT NOT NULL,
    parentId BIGINT,
    regDate TIMESTAMP NOT NULL DEFAULT NOW(),
    updateDate TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_comment_article FOREIGN KEY (articleId) REFERENCES article(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_member FOREIGN KEY (memberId) REFERENCES member(id),
    CONSTRAINT fk_comment_parent FOREIGN KEY (parentId) REFERENCES comment(id) ON DELETE CASCADE
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_comment_article') THEN
        CREATE INDEX idx_comment_article ON comment(articleId);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_comment_parent') THEN
        CREATE INDEX idx_comment_parent ON comment(parentId);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS article_like (
    id BIGSERIAL PRIMARY KEY,
    articleId BIGINT NOT NULL,
    memberId BIGINT NOT NULL,
    regDate TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT article_like_unique UNIQUE (articleId, memberId),
    CONSTRAINT fk_article_like_article FOREIGN KEY (articleId) REFERENCES article(id) ON DELETE CASCADE,
    CONSTRAINT fk_article_like_member FOREIGN KEY (memberId) REFERENCES member(id)
);

CREATE TABLE IF NOT EXISTS comment_like (
    id BIGSERIAL PRIMARY KEY,
    commentId BIGINT NOT NULL,
    memberId BIGINT NOT NULL,
    regDate TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT comment_like_unique UNIQUE (commentId, memberId),
    CONSTRAINT fk_comment_like_comment FOREIGN KEY (commentId) REFERENCES comment(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_like_member FOREIGN KEY (memberId) REFERENCES member(id)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_article_like_article') THEN
        CREATE INDEX idx_article_like_article ON article_like(articleId);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_comment_like_comment') THEN
        CREATE INDEX idx_comment_like_comment ON comment_like(commentId);
    END IF;
END $$;

