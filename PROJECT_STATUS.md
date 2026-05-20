# ContentPilot — 프로젝트 현황 문서
> 마지막 업데이트: 2026-05-20

---

## 🌐 배포 정보

| 항목 | 값 |
|------|-----|
| 사이트 URL | https://contentpilot-69x2.onrender.com |
| GitHub | https://github.com/marrywellwell-cell/ContentPilot |
| 로그인 URL | https://contentpilot-69x2.onrender.com/api/login |
| 플랫폼 | Render (무료 플랜) |
| 재배포 | GitHub main 브랜치 push 시 자동 |

---

## 🏗️ 기술 스택

- **프론트엔드**: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui
- **백엔드**: Express.js + TypeScript (ESM)
- **DB**: PostgreSQL (Render 무료) + Drizzle ORM
- **AI**: OpenAI GPT-4o (텍스트) + gpt-image-1-mini (이미지) + Gemini 폴백
- **인증**: 개발 모드 자동 로그인 (Google OAuth 미설정)

---

## 🔑 환경변수 (Render → ContentPilot → Environment)

| 변수명 | 설명 |
|--------|------|
| `DATABASE_URL` | PostgreSQL External URL + `?sslmode=require` |
| `OPENAI_API_KEY` | OpenAI API 키 |
| `GEMINI_API_KEY` | Google Gemini API 키 |
| `SESSION_SECRET` | 세션 시크릿 |
| `INSTAGRAM_APP_ID` | `1632701641151878` (snsdashboard) |
| `INSTAGRAM_APP_SECRET` | snsdashboard 앱 시크릿 |

---

## 📱 Instagram 발행 설정

### 현재 작동 방식
- **앱**: snsdashboard (App ID: 1632701641151878)
- **Instagram User ID**: `17841439030995091`
- **토큰 방식**: snsdash Graph API Explorer 사용자 토큰 → 서버에서 자동으로 Marrywell 페이지 토큰으로 교환
- **토큰 만료**: 약 60일

### 토큰 갱신 방법 (60일마다)
1. https://developers.facebook.com/tools/explorer 접속
2. Meta 앱: **snsdash** 선택
3. 권한: `pages_show_list`, `instagram_content_publish`, `instagram_basic`, `pages_read_engagement`
4. Generate Access Token 클릭
5. ContentPilot Settings → Instagram 연결해제 → 재입력:
   - User ID: `17841439030995091`
   - Access Token: 발급한 토큰
6. 저장 시 서버가 자동으로 Marrywell 페이지 토큰으로 교환

### 관련 Meta 앱 정보
| 앱 이름 | App ID | 용도 |
|---------|--------|------|
| ContentPilot | 2190286218411393 | 주 앱 |
| snsdash | 1919787851976986 | Instagram 토큰 발급용 (비즈니스 앱) |
| snsdashboard | 1632701641151878 | 환경변수에 등록됨 |
| ContentPilot-IG | 995161942931565 | Instagram Basic (다른 계정 소유) |

### Facebook/Instagram 연결 정보
- Facebook 페이지: **Marrywell** (ID: 1082965191562561)
- Instagram 계정: **@marrywellonoff** (Business Account ID: 17841439030995091)
- 연결 계정: Jiyeon Kim (marrywell@marrywell.co.kr)

---

## 🗄️ 데이터베이스

- **서비스명**: contentpilot-db (Render PostgreSQL 18)
- **상태**: Available
- **Internal URL**: `postgresql://...@dpg-d822u54vikkc73eaeb70-a/contentpilot_db_bzym`
- **External URL**: `postgresql://...@dpg-d822u54vikkc73eaeb70-a.oregon-postgres.render.com/contentpilot_db_bzym`
- **주의**: DATABASE_URL에 External URL + `?sslmode=require` 사용 필수

---

## 🚀 주요 기능 현황

### ✅ 완료된 기능
- AI 콘텐츠 생성 (인스타그램 + 블로그)
- 인스타그램 자동 발행 (캐러셀, 텍스트 합성)
- 발행 검토 다이얼로그 (슬라이드 편집 + 미리보기)
- 콘텐츠 리스트 (불러오기, 삭제)
- 유튜브 말씀 콘텐츠 생성
- 티스토리 HTML 복사 버튼 (base64 이미지 제거)
- 월간 플랜 생성
- 브랜드 분석
- 발명 아이디어 생성

### 🔧 알려진 이슈
- **메모리 세션**: 서버 재시작 시 로그인 풀림 → `/api/login` 으로 재로그인 필요
- **이미지 DB 미저장**: base64 이미지는 DB에 저장 안 됨 (크기 문제) → 생성 직후 사용 권장
- **OpenAI 크레딧**: 소진 시 콘텐츠 생성 불가 → https://platform.openai.com/settings/billing 에서 충전

---

## 📂 주요 파일 구조

```
server/
  ai.ts          — AI 콘텐츠 생성 (OpenAI/Gemini)
  publisher.ts   — Instagram/WordPress/Tistory 발행
  routes.ts      — API 라우트
  storage.ts     — DB 쿼리 (PostgreSQL)
  auth.ts        — 인증 (메모리 세션)

client/src/
  pages/
    Generate.tsx          — 콘텐츠 생성 메인
    ContentList.tsx       — 콘텐츠 리스트
    YouTubeScripture.tsx  — 유튜브 말씀
    InventionIdea.tsx     — 발명 아이디어
    Settings.tsx          — 플랫폼 연결 설정
  components/
    PublishReviewDialog.tsx  — 발행 검토
    InstagramPreview.tsx     — 인스타그램 미리보기
    BlogPreview.tsx          — 블로그 미리보기
  lib/
    downloadImage.ts      — 이미지 다운로드 + stripBase64Images()
```

---

## 🛠️ 로컬 개발 환경 설정

```bash
# 1. 클론
git clone https://github.com/marrywellwell-cell/ContentPilot.git
cd ContentPilot

# 2. 패키지 설치
npm install

# 3. 환경변수 설정 (.env 파일 생성)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
DATABASE_URL=postgresql://...(Render External URL)?sslmode=require
SESSION_SECRET=any-secret-string
INSTAGRAM_APP_ID=1632701641151878
INSTAGRAM_APP_SECRET=...

# 4. 개발 서버 실행
npm run dev
```

---

## 📋 티스토리 발행 방법 (API 종료됨 - 수동)

**T 버튼** 클릭 → HTML 자동 복사 + 티스토리 새 글 작성 페이지 열림

티스토리 에디터에서:
1. 우측 상단 **HTML** 버튼 클릭
2. `Ctrl+A` → `Ctrl+V`
3. **기본모드** 클릭 → 발행

- 유튜브 말씀 블로그 → https://inloglab.tistory.com (wisdom lab 카테고리)
- 발명 아이디어 블로그 → https://inloglab.tistory.com (life lab 카테고리)

---

## ⚠️ 주의사항

1. **Render 무료 플랜**: 15분 비활동 시 서버 슬립 → 첫 접속 30초 대기
2. **UptimeRobot 권장**: https://uptimerobot.com 에서 5분마다 ping 설정
3. **PostgreSQL 90일 만료**: Render 무료 DB는 90일 후 만료됨
4. **Instagram 토큰 60일**: 60일마다 수동 갱신 필요
