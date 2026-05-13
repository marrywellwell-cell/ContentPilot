/**
 * scripture_contents에 채널 정보 추가
 * Holy-AI-Creator DB에서 채널별 콘텐츠 매핑을 가져와 ContentPilot DB에 반영
 */
import pg from 'pg';
const { Client } = pg;

const HOLY_DB = 'postgresql://neondb_owner:npg_nlE0ImuxbUN9@ep-aged-tree-ahjlr8os.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const CONTENT_DB = 'postgresql://contentpilot_db_bzym_user:pKTKUG4ZBZr0Px591QXq6rbfsBAyS4xs@dpg-d822u54vikkc73eaeb70-a.oregon-postgres.render.com/contentpilot_db_bzym';

const holyClient = new Client({ connectionString: HOLY_DB });
const contentClient = new Client({ connectionString: CONTENT_DB, ssl: { rejectUnauthorized: false } });

await holyClient.connect();
await contentClient.connect();
console.log('✓ 양쪽 DB 연결');

// 1. scripture_contents에 channel_name 컬럼 추가
try {
  await contentClient.query(`ALTER TABLE scripture_contents ADD COLUMN IF NOT EXISTS channel_name TEXT`);
  await contentClient.query(`ALTER TABLE scripture_contents ADD COLUMN IF NOT EXISTS channel_url TEXT`);
  console.log('✓ channel_name, channel_url 컬럼 추가');
} catch (e) {
  console.log('컬럼 이미 존재:', e.message.slice(0, 50));
}

// 2. Holy-AI-Creator에서 채널 정보 포함한 콘텐츠 가져오기
const holyContent = await holyClient.query(`
  SELECT
    sc.source_url,
    sc.core_message,
    mc.channel_name,
    mc.channel_url,
    mc.channel_id
  FROM saved_content sc
  LEFT JOIN monitored_channels mc ON sc.channel_id = mc.channel_id
  WHERE sc.source_url IS NOT NULL
`);

console.log(`\nHoly-AI-Creator 콘텐츠 ${holyContent.rows.length}개 채널 매핑 확인`);

// 채널별 카운트 출력
const channelCounts = {};
for (const row of holyContent.rows) {
  const ch = row.channel_name || '채널 없음';
  channelCounts[ch] = (channelCounts[ch] || 0) + 1;
}
Object.entries(channelCounts).forEach(([ch, cnt]) => console.log(`  - ${ch}: ${cnt}개`));

// 3. ContentPilot DB scripture_contents에 채널 정보 업데이트
console.log('\nContentPilot DB 채널 정보 업데이트 중...');
let updated = 0;

for (const row of holyContent.rows) {
  if (!row.source_url || !row.channel_name) continue;
  try {
    const r = await contentClient.query(`
      UPDATE scripture_contents
      SET channel_name = $1, channel_url = $2
      WHERE youtube_url = $3 AND channel_name IS NULL
    `, [row.channel_name, row.channel_url, row.source_url]);
    updated += r.rowCount;
  } catch (e) {
    // 무시
  }
}

console.log(`✓ ${updated}개 채널 정보 업데이트`);

// 4. 채널별 현황 확인
const channelStats = await contentClient.query(`
  SELECT channel_name, COUNT(*) as count
  FROM scripture_contents
  GROUP BY channel_name
  ORDER BY count DESC
`);

console.log('\nContentPilot 채널별 현황:');
channelStats.rows.forEach(r =>
  console.log(`  ${r.channel_name || '채널 없음'}: ${r.count}개`)
);

await holyClient.end();
await contentClient.end();
console.log('\n✅ 완료!');
