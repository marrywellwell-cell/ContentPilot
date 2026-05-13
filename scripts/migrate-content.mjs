/**
 * Holy-AI-Creator → ContentPilot 콘텐츠 마이그레이션
 */
import pg from 'pg';
const { Client } = pg;

const HOLY_DB = 'postgresql://neondb_owner:npg_nlE0ImuxbUN9@ep-aged-tree-ahjlr8os.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const CONTENT_DB = 'postgresql://contentpilot_db_bzym_user:pKTKUG4ZBZr0Px591QXq6rbfsBAyS4xs@dpg-d822u54vikkc73eaeb70-a.oregon-postgres.render.com/contentpilot_db_bzym';

const holyClient = new Client({ connectionString: HOLY_DB });
const contentClient = new Client({ connectionString: CONTENT_DB, ssl: { rejectUnauthorized: false } });

await holyClient.connect();
console.log('✓ Holy-AI-Creator DB 연결');

await contentClient.connect();
console.log('✓ ContentPilot DB 연결\n');

// ─── 1. Holy-AI-Creator 스키마 확인 ────────────────────────────────────────
console.log('Holy-AI-Creator 테이블 목록:');
const tables = await holyClient.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name
`);
tables.rows.forEach(r => console.log(' -', r.table_name));

// ─── 2. saved_content 데이터 읽기 ──────────────────────────────────────────
console.log('\nHoly-AI-Creator 콘텐츠 읽는 중...');
const savedContent = await holyClient.query(`
  SELECT * FROM saved_content ORDER BY created_at DESC
`);
console.log(`총 ${savedContent.rows.length}개 콘텐츠 발견`);

// 인스타그램 vs 블로그 분류
const instagramItems = savedContent.rows.filter(r => !r.blog_content && r.content_type !== 'blog');
const blogItems = savedContent.rows.filter(r => r.blog_content && r.blog_content.length > 0);
console.log(`- 인스타그램: ${instagramItems.length}개`);
console.log(`- 블로그: ${blogItems.length}개`);

// ─── 3. ContentPilot scripture_contents에 삽입 ─────────────────────────────
console.log('\nContentPilot으로 이전 중...');
let successCount = 0;
let failCount = 0;

const DEV_USER_ID = 'dev-user-001';

for (const item of savedContent.rows) {
  try {
    // Holy-AI-Creator 필드 → ContentPilot 필드 매핑
    const imageUrls = item.image_url ? [item.image_url] : [];
    const hashtags = Array.isArray(item.hashtags) ? item.hashtags : [];

    // 캡션에서 해시태그 분리
    let caption = item.caption || '';
    if (caption.includes('#')) {
      const parts = caption.split('\n\n');
      caption = parts.slice(0, -1).join('\n\n') || caption;
    }

    await contentClient.query(`
      INSERT INTO scripture_contents (
        user_id, youtube_url, video_title, video_summary,
        bible_verse, bible_reference,
        instagram_slides, instagram_caption, instagram_hashtags,
        image_urls, blog_title, blog_content, blog_meta_description,
        created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT DO NOTHING
    `, [
      DEV_USER_ID,
      item.source_url || null,
      item.core_message?.slice(0, 100) || item.verse_reference || '말씀 콘텐츠',
      Array.isArray(item.summary) ? item.summary.join(' ') : (item.summary || ''),
      item.verse_content || '',
      item.verse_reference || '',
      [], // instagram_slides (Holy-AI-Creator는 단일 이미지)
      caption,
      hashtags,
      imageUrls,
      item.blog_title || (item.blog_content ? item.verse_reference : null),
      item.blog_content || null,
      null, // blog_meta_description
      item.created_at || new Date(),
    ]);
    successCount++;
  } catch (e) {
    failCount++;
    if (failCount <= 3) console.warn(`  오류: ${e.message.slice(0, 80)}`);
  }
}

console.log(`\n✅ 이전 완료: ${successCount}개 성공, ${failCount}개 실패`);

// ─── 4. 채널별 콘텐츠 연결 (monitored_channels → saved_youtube_channels) ──
console.log('\n채널 데이터 확인 중...');
try {
  const channels = await holyClient.query(`SELECT * FROM monitored_channels ORDER BY created_at`);
  console.log(`Holy-AI-Creator 채널: ${channels.rows.length}개`);

  for (const ch of channels.rows) {
    const channelUrl = ch.channel_url || `https://youtube.com/channel/${ch.channel_id}`;
    await contentClient.query(`
      INSERT INTO saved_youtube_channels (user_id, channel_url, channel_name, is_active, processed_video_ids)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [DEV_USER_ID, channelUrl, ch.channel_name, ch.is_active === 'true', []]);
    console.log(`  ✓ ${ch.channel_name}`);
  }
} catch (e) {
  console.log('채널 마이그레이션 건너뜀:', e.message.slice(0, 60));
}

// ─── 5. 최종 현황 ──────────────────────────────────────────────────────────
console.log('\nContentPilot DB 최종 현황:');
const scr = await contentClient.query('SELECT COUNT(*) FROM scripture_contents');
const ch2 = await contentClient.query('SELECT COUNT(*) FROM saved_youtube_channels');
console.log(`  scripture_contents: ${scr.rows[0].count}개`);
console.log(`  saved_youtube_channels: ${ch2.rows[0].count}개`);

await holyClient.end();
await contentClient.end();
console.log('\n🎉 마이그레이션 완료!');
