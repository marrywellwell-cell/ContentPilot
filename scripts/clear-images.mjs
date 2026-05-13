import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://contentpilot_db_bzym_user:pKTKUG4ZBZr0Px591QXq6rbfsBAyS4xs@dpg-d822u54vikkc73eaeb70-a.oregon-postgres.render.com/contentpilot_db_bzym',
  ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('✓ DB 연결');

// Replit 서버 이미지 URL 초기화 (파일이 존재하지 않음)
const r = await client.query(
  "UPDATE scripture_contents SET image_urls = ARRAY[]::text[] WHERE image_urls IS NOT NULL"
);
console.log(`✓ ${r.rowCount}개 항목 이미지 URL 초기화 완료`);

const count = await client.query('SELECT COUNT(*) FROM scripture_contents');
console.log(`총 콘텐츠: ${count.rows[0].count}개`);

await client.end();
console.log('✅ 완료!');
