// X-Creator-Studio 数据库 Schema 定义 (基于 SQLite DatabaseSync)

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT 'Online',
  target_niche TEXT NOT NULL DEFAULT '[]',
  tone_style TEXT NOT NULL DEFAULT '',
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  tweets_count INTEGER NOT NULL DEFAULT 0,
  monthly_impressions TEXT NOT NULL DEFAULT '0',
  engagement_rate TEXT NOT NULL DEFAULT '0.0%',
  default_publish_mode TEXT NOT NULL DEFAULT 'manual_intent',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_posts (
  id TEXT PRIMARY KEY,
  creator_handle TEXT NOT NULL,
  post_id TEXT NOT NULL,
  original_text TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  published_at TEXT NOT NULL,
  original_url TEXT NOT NULL DEFAULT '',
  media_urls TEXT NOT NULL DEFAULT '[]',
  theme TEXT NOT NULL DEFAULT '未分类',
  core_viewpoint TEXT NOT NULL DEFAULT '',
  expression_style TEXT NOT NULL DEFAULT '',
  source_references TEXT NOT NULL DEFAULT '[]',
  keywords TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT '未分类',
  impressions INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  retweets INTEGER NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'published',
  raw_payload TEXT NOT NULL DEFAULT '{}',
  last_synced_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(creator_handle, post_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_creator ON knowledge_posts(creator_handle);
CREATE INDEX IF NOT EXISTS idx_posts_hash ON knowledge_posts(text_hash);
CREATE INDEX IF NOT EXISTS idx_posts_category ON knowledge_posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_published ON knowledge_posts(published_at DESC);

CREATE TABLE IF NOT EXISTS compliance_rules (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'Global',
  official_source_url TEXT NOT NULL,
  rule_version TEXT NOT NULL DEFAULT '2026.1',
  regex_pattern TEXT NOT NULL DEFAULT '',
  keywords TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS search_cache (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  provider TEXT NOT NULL,
  raw_results TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_query ON search_cache(query);

CREATE TABLE IF NOT EXISTS creation_batches (
  id TEXT PRIMARY KEY,
  creator_handle TEXT NOT NULL,
  batch_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  text_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  image_model TEXT NOT NULL DEFAULT 'none',
  total_tokens_used INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generation_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  angle TEXT NOT NULL,
  image_prompt TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  generated_text TEXT NOT NULL,
  originality_score INTEGER NOT NULL DEFAULT 100,
  originality_status TEXT NOT NULL DEFAULT 'passed',
  originality_reasons TEXT NOT NULL DEFAULT '[]',
  compliance_status TEXT NOT NULL DEFAULT 'PASS',
  compliance_violations TEXT NOT NULL DEFAULT '[]',
  sources TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ready_for_review',
  is_confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(batch_id) REFERENCES creation_batches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_batch ON generation_items(batch_id);
`;
