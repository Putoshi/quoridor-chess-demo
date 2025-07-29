@echo off
echo ===================================
echo Quoridor Chess Online 起動スクリプト
echo ===================================

if "%1"=="--help" goto help
if "%1"=="-h" goto help
if "%1"=="" goto all
if "%1"=="all" goto all
if "%1"=="backend" goto backend
if "%1"=="frontend" goto frontend
if "%1"=="stop" goto stop
if "%1"=="logs" goto logs
goto invalid

:help
echo 使用方法: start.bat [オプション]
echo.
echo オプション:
echo   all       - バックエンドとフロントエンドを両方起動（デフォルト）
echo   backend   - Nakamaバックエンドのみ起動
echo   frontend  - フロントエンドのみ起動
echo   stop      - すべてのサービスを停止
echo   logs      - Nakamaのログを表示
echo   --help    - このヘルプを表示
goto end

:all
call :start_backend
echo.
call :start_frontend
goto end

:backend
call :start_backend
goto end

:frontend
call :start_frontend
goto end

:stop
echo 🛑 サービスを停止しています...
docker-compose down
echo ✅ すべてのサービスを停止しました
goto end

:logs
echo 📄 Nakamaのログを表示します (終了: Ctrl+C)
docker-compose logs -f nakama
goto end

:start_backend
echo 🚀 Nakamaバックエンドを起動しています...

REM Dockerの確認
docker info > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Dockerが起動していません。
    echo Docker Desktopを起動してください。
    exit /b 1
)

REM Go依存関係のダウンロード
echo 📦 Go依存関係をダウンロード中...
cd backend\modules
go mod download 2>nul || echo ⚠️  Go依存関係のダウンロードをスキップ（Goがインストールされていない可能性があります）
cd ..\..

REM Docker Composeで起動
docker-compose up -d

echo ⏳ Nakamaサーバーの起動を待っています...
timeout /t 5 /nobreak > nul

REM ヘルスチェック
set count=0
:healthcheck
set /a count+=1
curl -f http://localhost:7350/ > nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Nakamaバックエンドが起動しました！
    echo    - ゲームサーバー: http://localhost:7350
    echo    - 管理コンソール: http://localhost:7351 (admin/password)
    exit /b 0
)
if %count% lss 10 (
    echo ⏳ 起動確認中... (%count%/10)
    timeout /t 2 /nobreak > nul
    goto healthcheck
)
echo ❌ Nakamaの起動に失敗しました
exit /b 1

:start_frontend
echo 🚀 フロントエンドを起動しています...

REM Node.jsの確認
node -v > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.jsがインストールされていません。
    echo Node.jsをインストールしてください: https://nodejs.org/
    exit /b 1
)

cd frontend

REM 依存関係のインストール
if not exist "node_modules" (
    echo 📦 依存関係をインストール中...
    npm install
)

echo ✅ フロントエンドを起動しました！
echo    - アプリケーション: http://localhost:3000
echo.
echo 🎮 ゲームの遊び方:
echo    1. ブラウザで2つのタブを開く
echo    2. それぞれ別のユーザー名でログイン
echo    3. ランダムマッチを開始してマッチング
echo    4. チャットで会話を楽しむ
echo.
echo 終了するには Ctrl+C を押してください

REM フロントエンドサーバーを起動
npm run dev
exit /b 0

:invalid
echo ❌ 不明なオプション: %1
echo 使用方法: start.bat [all^|backend^|frontend^|stop^|logs^|--help]

:end