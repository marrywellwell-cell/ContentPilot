@echo off
cd /d "%~dp0"

:: .env 파일에서 환경변수 로드
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if not "%%A"=="" (
    if not "%%A:~0,1%"=="#" (
      set "%%A=%%B"
    )
  )
)

echo [ContentPilot] 환경변수 로드 완료
echo [ContentPilot] 서버 시작 중...
echo [ContentPilot] 브라우저에서 http://localhost:5000 접속하세요
echo.

npx tsx server/index-dev.ts
