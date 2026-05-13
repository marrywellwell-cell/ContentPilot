# ContentPilot 고도화 가이드

## 변경 내역 요약

### 1. Replit 의존성 완전 제거 (Vercel/Railway 배포 가능)
- `vite.config.ts` — Replit 플러그인 제거, 개발 서버 proxy 추가
- `server/ai.ts` — `AI_INTEGRATIONS_*` 환경변수 → `OPENAI_API_KEY`, `GEMINI_API_KEY`로 교체
- `package.json` — Replit 전용 vite 플러그인 제거

### 2. 인증 시스템 교체 (Replit Auth → Google OAuth)
- `server/auth.ts` 신규 생성 — `passport-google-oauth20` 기반
- `server/routes.ts` — `replitAuth` → `auth` import 교체, `req.user.claims.sub` → `(req.user as any).id`

### 3. Instagram 자동 발행 (Instagram Graph API v21)
- `server/publisher.ts` — 단일 이미지 / 캐러셀 발행 완전 구현
- `POST /api/publish/:contentSetId` — 수동 즉시 발행 API 추가
- `GET /api/images/temp/:id` — 임시 이미지 서빙 엔드포인트 (Instagram용)
- `server/scheduler.ts` — 예약 발행 시 실제 API 호출 연결

### 4. WordPress / Tistory 블로그 자동 발행
- WordPress REST API + Application Password 인증
- Tistory Open API v1 연동

### 5. 플랫폼 연결 관리
- `shared/schema.ts` — `platform_connections` 테이블 추가
- `server/storage.ts` — CRUD 메서드 추가
- `GET/POST/DELETE /api/platform-connections` — 연결 관리 API
- `client/src/pages/Settings.tsx` — 실제 연결 UI (Instagram/WordPress/Tistory)

### 6. 배포 설정
- `.env.example` — 필요한 환경변수 목록
- `railway.toml` — Railway 배포 설정
- `migrations/add_platform_connections.sql` — DB 마이그레이션 SQL

---

## 배포 절차 (Railway)

### 1. PostgreSQL DB 준비
- Railway에서 PostgreSQL 서비스 추가 또는 Neon 사용

### 2. Google OAuth 앱 등록
1. https://console.cloud.google.com → APIs & Services → Credentials
2. OAuth 2.0 클라이언트 생성 (Web application)
3. 승인된 리디렉션 URI: `https://your-app.railway.app/api/auth/google/callback`

### 3. 환경변수 설정 (Railway 대시보드)
```
DATABASE_URL=postgresql://...
SESSION_SECRET=랜덤-긴-문자열
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=https://your-app.railway.app/api/auth/google/callback
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
APP_BASE_URL=https://your-app.railway.app
NODE_ENV=production
```

### 4. DB 마이그레이션
```bash
# platform_connections 테이블 추가
psql $DATABASE_URL -f migrations/add_platform_connections.sql

# 또는 drizzle-kit 사용
npm run db:push
```

### 5. 배포
```bash
git push railway main
```

---

## Instagram 발행 설정

Instagram Graph API 사용을 위해 필요한 것:
1. **Facebook Developer 계정** + 앱 생성
2. **Instagram Business/Creator 계정** (개인 계정 불가)
3. **권한**: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`
4. **Long-lived Access Token** (60일 유효, 갱신 필요)

앱 내 설정 페이지(Settings)에서 Instagram User ID와 Access Token을 입력하면 됩니다.

---

## WordPress 발행 설정

1. WordPress 관리자 → 사용자 → 프로필 → Application Passwords
2. 새 Application Password 생성 (이름: ContentPilot)
3. 앱 내 Settings 페이지에서 사이트 URL, 사용자명, App Password 입력

---

## Tistory 발행 설정

1. https://tistory.com/guide/api 에서 앱 등록
2. OAuth 2.0 인증으로 Access Token 발급
3. 앱 내 Settings 페이지에서 Access Token과 블로그 이름 입력
