/**
 * Holy-AI-Creator → ContentPilot 데이터 마이그레이션
 * - 유튜브 채널 3개 등록
 * - Holy-AI-Creator DB의 기존 콘텐츠 가져오기 (URL 제공 시)
 */

import pg from 'pg';
const { Client } = pg;

const CONTENT_DB = 'postgresql://contentpilot_db_bzym_user:pKTKUG4ZBZr0Px591QXq6rbfsBAyS4xs@dpg-d822u54vikkc73eaeb70-a.oregon-postgres.render.com/contentpilot_db_bzym';

const client = new Client({ connectionString: CONTENT_DB, ssl: { rejectUnauthorized: false } });

// ─── 기본 사용자 생성 (Holy-AI-Creator 콘텐츠 소유자) ────────────────────────
const DEV_USER_ID = 'dev-user-001';

// ─── 채널 목록 (Holy-AI-Creator에서 확인한 3개 채널) ─────────────────────────
const channels = [
  {
    id: 'ch-dreamchurch10',
    userId: DEV_USER_ID,
    channelUrl: 'https://www.youtube.com/@dreamchurch10',
    channelName: '김학중 목사_꿈의교회 미디어교회',
    isActive: true,
    processedVideoIds: [],
  },
  {
    id: 'ch-saeroun-church',
    userId: DEV_USER_ID,
    channelUrl: 'https://www.youtube.com/@Saeroun-Church',
    channelName: '새로운교회',
    isActive: true,
    processedVideoIds: [],
  },
  {
    id: 'ch-gracemission',
    userId: DEV_USER_ID,
    channelUrl: 'https://www.youtube.com/@gracemissionchurch2237',
    channelName: '은혜선교회 (하현일목사)',
    isActive: true,
    processedVideoIds: [],
  },
];

async function run() {
  await client.connect();
  console.log('✓ DB 연결 성공\n');

  // 1. 기본 사용자 확인/생성
  try {
    await client.query(`
      INSERT INTO users (id, email, first_name, is_admin, created_at, updated_at)
      VALUES ($1, $2, $3, true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [DEV_USER_ID, 'dev@contentpilot.local', '관리자']);
    console.log('✓ 기본 사용자 확인');
  } catch (e) {
    console.warn('사용자 생성 경고:', e.message.slice(0, 60));
  }

  // 2. 채널 등록
  console.log('\n채널 등록 중...');
  for (const ch of channels) {
    try {
      await client.query(`
        INSERT INTO saved_youtube_channels
          (id, user_id, channel_url, channel_name, is_active, processed_video_ids, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT DO NOTHING
      `, [ch.id, ch.userId, ch.channelUrl, ch.channelName, ch.isActive, ch.processedVideoIds]);
      console.log(`✓ ${ch.channelName}`);
    } catch (e) {
      console.warn(`채널 등록 경고: ${e.message.slice(0, 80)}`);
    }
  }

  // 3. 테이블 확인
  console.log('\n테이블 현황:');
  const tables = ['users', 'sessions', 'content_sets', 'scripture_contents',
                  'saved_youtube_channels', 'brand_analyses', 'platform_connections'];
  for (const t of tables) {
    try {
      const r = await client.query(`SELECT COUNT(*) FROM ${t}`);
      console.log(`  ${t}: ${r.rows[0].count}개`);
    } catch (e) {
      console.log(`  ${t}: 테이블 없음 (${e.message.slice(0, 40)})`);
    }
  }

  await client.end();
  console.log('\n✅ 완료!');
  console.log('\n💡 Holy-AI-Creator DB URL을 제공하시면 74개 인스타 + 16개 블로그 콘텐츠도 이전합니다.');
}

run().catch(console.error);
