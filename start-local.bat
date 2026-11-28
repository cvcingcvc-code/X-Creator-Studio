@echo off
chcp 65001 >nul
cd /d E:\Projects\X-Creator-Studio

echo ================================================
echo   X-Creator-Studio 本地创作台启动中...
echo   访问地址: http://localhost:3000
echo   数据保存位置: E:\Projects\X-Creator-Studio\data\x-creator.db
echo ================================================

if not exist ".env.local" (
  echo [提示] 尚未发现 .env.local，已为你从 .env.example 自动复制一份。
  echo [提示] 请用记事本打开 .env.local 填入你的 DEEPSEEK_API_KEY 后重启本脚本。
  copy .env.example .env.local >nul
)

start "" http://localhost:3000
npm run dev
pause
