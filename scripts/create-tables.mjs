import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const DB_URL = 'postgresql://contentpilot_db_bzym_user:pKTKUG4ZBZr0Px591QXq6rbfsBAyS4xs@dpg-d822u54vikkc73eaeb70-a.oregon-postgres.render.com/contentpilot_db_bzym';

const sql = readFileSync(join(__dirname, '../migrations/create_all_tables.sql'), 'utf-8');

const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('DB 연결 성공');

  // SQL을 세미콜론으로 분리해서 순차 실행
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await client.query(stmt);
      const tableMatch = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (tableMatch) console.log(`✓ 테이블 생성: ${tableMatch[1]}`);
      else if (stmt.includes('CREATE INDEX')) console.log(`✓ 인덱스 생성`);
      else if (stmt.includes('SELECT')) {
        const r = await client.query(stmt);
        console.log('결과:', r.rows[0]);
      }
    } catch (e) {
      console.warn(`경고: ${e.message.slice(0, 80)}`);
    }
  }

  console.log('\n✅ 모든 테이블 생성 완료!');
} catch (e) {
  console.error('오류:', e.message);
} finally {
  await client.end();
}
