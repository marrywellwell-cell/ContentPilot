import pg from 'pg';
const { Client } = pg;

const DB_URL = 'postgresql://contentpilot_db_bzym_user:pKTKUG4ZBZr0Px591QXq6rbfsBAyS4xs@dpg-d822u54vikkc73eaeb70-a.oregon-postgres.render.com/contentpilot_db_bzym';
const BASE = 'https://holy-ai-creator--khjyeon.replit.app';

const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log('✓ DB 연결');

// 업데이트 전 샘플 확인
const before = await client.query(
  "SELECT image_urls FROM scripture_contents WHERE image_urls IS NOT NULL AND array_length(image_urls,1)>0 LIMIT 2"
);
console.log('업데이트 전:', before.rows[0]?.image_urls?.[0]);

// /generated/ 로 시작하는 상대 URL → 절대 URL 변환
const result = await client.query(`
  UPDATE scripture_contents
  SET image_urls = ARRAY(
    SELECT CASE
      WHEN url LIKE '/generated/%' THEN $1 || url
      ELSE url
    END
    FROM unnest(image_urls) AS url
  )
  WHERE image_urls IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM unnest(image_urls) AS url WHERE url LIKE '/generated/%'
    )
`, [BASE]);

console.log(`✓ ${result.rowCount}개 콘텐츠 이미지 URL 업데이트 완료`);

// 업데이트 후 확인
const after = await client.query(
  "SELECT image_urls FROM scripture_contents WHERE image_urls IS NOT NULL AND array_length(image_urls,1)>0 LIMIT 3"
);
console.log('\n업데이트 후 샘플:');
after.rows.forEach((r, i) => console.log(`  ${i+1}. ${r.image_urls[0]}`));

// 이미지 없는 항목 수 확인
const noImg = await client.query(
  "SELECT COUNT(*) FROM scripture_contents WHERE image_urls IS NULL OR array_length(image_urls,1) IS NULL OR array_length(image_urls,1)=0"
);
console.log(`\n이미지 없는 항목: ${noImg.rows[0].count}개`);

await client.end();
console.log('\n✅ 완료!');
