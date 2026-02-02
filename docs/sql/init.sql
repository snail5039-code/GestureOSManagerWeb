CREATE TABLE IF NOT EXISTS translation_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  text TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_translation_log_created_at
  ON translation_log (created_at DESC);
  
CREATE TABLE IF NOT EXISTS gestureos_learner_profile (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL,
  profile_name VARCHAR(200) NOT NULL,
  model_json JSONB NOT NULL,
  regDate TIMESTAMP NOT NULL DEFAULT NOW(),
  updateDate TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_learner_profile UNIQUE (member_id, profile_name),
  CONSTRAINT fk_learner_profile_member
    FOREIGN KEY (member_id) REFERENCES member(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learner_profile_member_name
  ON gestureos_learner_profile(member_id, profile_name);
