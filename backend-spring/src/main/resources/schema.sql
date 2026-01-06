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

