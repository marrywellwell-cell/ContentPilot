-- platform_connections 테이블 추가
-- 실행: psql $DATABASE_URL -f migrations/add_platform_connections.sql

CREATE TABLE IF NOT EXISTS platform_connections (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  platform TEXT NOT NULL,

  -- Instagram Graph API
  instagram_user_id TEXT,
  instagram_access_token TEXT,
  instagram_username TEXT,
  instagram_token_expires_at TIMESTAMP,

  -- WordPress REST API
  wordpress_url TEXT,
  wordpress_username TEXT,
  wordpress_app_password TEXT,

  -- Tistory Open API
  tistory_access_token TEXT,
  tistory_blog_name TEXT,

  -- Naver Blog API
  naver_access_token TEXT,
  naver_refresh_token TEXT,

  -- Common
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, platform)
);
