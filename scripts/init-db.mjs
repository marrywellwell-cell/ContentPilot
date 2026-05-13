import pg from 'pg';
const { Client } = pg;

const DB_URL = 'postgresql://contentpilot_db_bzym_user:pKTKUG4ZBZr0Px591QXq6rbfsBAyS4xs@dpg-d822u54vikkc73eaeb70-a.oregon-postgres.render.com/contentpilot_db_bzym';

const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log('✓ DB 연결');

const sqls = [
  `CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire)`,
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE,
    first_name VARCHAR,
    last_name VARCHAR,
    profile_image_url VARCHAR,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS brand_analyses (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(id),
    brand_name TEXT NOT NULL,
    product_service TEXT NOT NULL,
    usp TEXT, customer_persona TEXT, pain_points TEXT, solution TEXT,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS monthly_plans (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(id),
    brand_analysis_id VARCHAR REFERENCES brand_analyses(id),
    year TEXT NOT NULL, month TEXT NOT NULL, title TEXT NOT NULL,
    themes TEXT[], content_items JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS content_sets (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(id),
    brand_analysis_id VARCHAR REFERENCES brand_analyses(id),
    keyword TEXT NOT NULL,
    instagram_slides TEXT[], instagram_caption TEXT,
    instagram_hashtags TEXT[], instagram_image_urls TEXT[],
    blog_title TEXT, blog_content TEXT, blog_meta_description TEXT,
    blog_html TEXT, blog_image_urls TEXT[], blog_titles TEXT[],
    blog_thumbnail_texts TEXT[], blog_image_recommendations JSONB,
    blog_internal_link_topics TEXT[], blog_hashtags TEXT[],
    scheduled_date TIMESTAMP, status TEXT NOT NULL DEFAULT 'draft',
    platforms TEXT[], created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS scripture_contents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(id),
    youtube_url TEXT, video_title TEXT NOT NULL,
    video_summary TEXT, bible_verse TEXT NOT NULL, bible_reference TEXT NOT NULL,
    instagram_slides TEXT[], instagram_caption TEXT, instagram_hashtags TEXT[],
    image_urls TEXT[], blog_title TEXT, blog_content TEXT,
    blog_meta_description TEXT, created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS scripture_automations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(id),
    channel_url TEXT, is_active BOOLEAN DEFAULT FALSE,
    frequency TEXT DEFAULT 'daily', verse_hint TEXT, last_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS saved_youtube_channels (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(id),
    channel_url TEXT NOT NULL, channel_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE, last_checked_at TIMESTAMP,
    processed_video_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS invention_ideas (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(id),
    title TEXT NOT NULL, problem TEXT NOT NULL, solution TEXT NOT NULL,
    use_cases TEXT, target_audience TEXT[] DEFAULT '{}',
    tone TEXT NOT NULL DEFAULT 'professional', status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS invention_contents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id VARCHAR REFERENCES invention_ideas(id),
    user_id VARCHAR REFERENCES users(id),
    content_type TEXT NOT NULL,
    instagram_slides TEXT[], instagram_image_urls TEXT[],
    instagram_caption TEXT, instagram_hashtags TEXT[],
    shorts_script TEXT, shorts_scenes JSONB, shorts_duration TEXT,
    shorts_title TEXT, shorts_hook TEXT, shorts_hashtags TEXT[],
    shorts_video_url TEXT, shorts_thumbnail_url TEXT,
    blog_title TEXT, blog_content TEXT, blog_html TEXT,
    blog_meta_description TEXT, blog_hashtags TEXT[], copyright TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS upload_history (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(id),
    content_id VARCHAR REFERENCES invention_contents(id),
    platform TEXT NOT NULL, upload_type TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'pending',
    external_id TEXT, external_url TEXT, views TEXT, likes TEXT, notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(id) NOT NULL,
    name TEXT NOT NULL, key TEXT NOT NULL UNIQUE,
    last_used_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS platform_connections (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(id) NOT NULL,
    platform TEXT NOT NULL,
    instagram_user_id TEXT, instagram_access_token TEXT,
    instagram_username TEXT, instagram_token_expires_at TIMESTAMP,
    wordpress_url TEXT, wordpress_username TEXT, wordpress_app_password TEXT,
    tistory_access_token TEXT, tistory_blog_name TEXT,
    naver_access_token TEXT, naver_refresh_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, platform)
  )`,
];

for (const sql of sqls) {
  try {
    await client.query(sql);
    const m = sql.match(/CREATE (?:TABLE|INDEX)[^(]*?(?:IF NOT EXISTS\s+)?["']?(\w+)["']?/i);
    if (m) console.log(`✓ ${m[1]}`);
  } catch (e) {
    console.error(`✗ 오류: ${e.message.slice(0, 100)}`);
  }
}

// 기본 사용자 + 채널 등록
console.log('\n기본 데이터 등록...');

await client.query(`
  INSERT INTO users (id, email, first_name, is_admin)
  VALUES ('dev-user-001','dev@contentpilot.local','관리자',true)
  ON CONFLICT (id) DO NOTHING
`).catch(e => console.warn('사용자:', e.message.slice(0,50)));

const channels = [
  ['ch-01','dev-user-001','https://www.youtube.com/@dreamchurch10','김학중 목사_꿈의교회 미디어교회'],
  ['ch-02','dev-user-001','https://www.youtube.com/@Saeroun-Church','새로운교회'],
  ['ch-03','dev-user-001','https://www.youtube.com/@gracemissionchurch2237','은혜선교회 (하현일목사)'],
];

for (const [id, uid, url, name] of channels) {
  await client.query(
    `INSERT INTO saved_youtube_channels (id,user_id,channel_url,channel_name,is_active,processed_video_ids)
     VALUES ($1,$2,$3,$4,true,'{}') ON CONFLICT DO NOTHING`,
    [id, uid, url, name]
  ).then(() => console.log(`✓ 채널: ${name}`))
   .catch(e => console.warn(`채널 오류: ${e.message.slice(0,60)}`));
}

// 최종 확인
const tables = ['users','sessions','content_sets','scripture_contents','saved_youtube_channels','platform_connections'];
console.log('\n현황:');
for (const t of tables) {
  const r = await client.query(`SELECT COUNT(*) FROM ${t}`).catch(() => ({rows:[{count:'X'}]}));
  console.log(`  ${t}: ${r.rows[0].count}`);
}

await client.end();
console.log('\n✅ DB 초기화 완료!');
