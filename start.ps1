param(
    [Parameter(Position=0)]
    [string]$Mode = "all"
)

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Quoridor Chess Online 起動スクリプト" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

function Show-Help {
    Write-Host @"
使用方法: .\start.ps1 [オプション]

オプション:
  all       - バックエンドとフロントエンドを両方起動（デフォルト）
  backend   - Nakamaバックエンドのみ起動
  frontend  - フロントエンドのみ起動
  stop      - すべてのサービスを停止
  logs      - Nakamaのログを表示
  -help     - このヘルプを表示
"@
}

function Test-Docker {
    try {
        docker info | Out-Null
        return $true
    } catch {
        Write-Host "❌ Dockerが起動していません。" -ForegroundColor Red
        Write-Host "Docker Desktopを起動してください。" -ForegroundColor Yellow
        return $false
    }
}

function Start-Backend {
    Write-Host "🚀 Nakamaバックエンドを起動しています..." -ForegroundColor Green
    
    if (-not (Test-Docker)) {
        exit 1
    }
    
    # Go依存関係のダウンロード
    Write-Host "📦 Go依存関係をダウンロード中..." -ForegroundColor Yellow
    Push-Location backend/modules
    try {
        go mod download 2>$null
    } catch {
        Write-Host "⚠️  Go依存関係のダウンロードをスキップ（Goがインストールされていない可能性があります）" -ForegroundColor Yellow
    }
    Pop-Location
    
    # Docker Composeで起動
    docker-compose up -d
    
    Write-Host "⏳ Nakamaサーバーの起動を待っています..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # ヘルスチェック
    for ($i = 1; $i -le 10; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:7350/" -UseBasicParsing -ErrorAction Stop
            Write-Host "✅ Nakamaバックエンドが起動しました！" -ForegroundColor Green
            Write-Host "   - ゲームサーバー: http://localhost:7350" -ForegroundColor Cyan
            Write-Host "   - 管理コンソール: http://localhost:7351 (admin/password)" -ForegroundColor Cyan
            return
        } catch {
            Write-Host "⏳ 起動確認中... ($i/10)" -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
    }
    Write-Host "❌ Nakamaの起動に失敗しました" -ForegroundColor Red
    exit 1
}

function Start-Frontend {
    Write-Host "🚀 フロントエンドを起動しています..." -ForegroundColor Green
    
    # Node.jsの確認
    try {
        node -v | Out-Null
    } catch {
        Write-Host "❌ Node.jsがインストールされていません。" -ForegroundColor Red
        Write-Host "Node.jsをインストールしてください: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
    
    Push-Location frontend
    
    # 依存関係のインストール
    if (-not (Test-Path "node_modules")) {
        Write-Host "📦 依存関係をインストール中..." -ForegroundColor Yellow
        npm install
    }
    
    Write-Host "✅ フロントエンドを起動しました！" -ForegroundColor Green
    Write-Host "   - アプリケーション: http://localhost:3000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🎮 ゲームの遊び方:" -ForegroundColor Magenta
    Write-Host "   1. ブラウザで2つのタブを開く"
    Write-Host "   2. それぞれ別のユーザー名でログイン"
    Write-Host "   3. ランダムマッチを開始してマッチング"
    Write-Host "   4. チャットで会話を楽しむ"
    Write-Host ""
    Write-Host "終了するには Ctrl+C を押してください" -ForegroundColor Yellow
    
    # フロントエンドサーバーを起動
    npm run dev
    Pop-Location
}

function Stop-Services {
    Write-Host "🛑 サービスを停止しています..." -ForegroundColor Yellow
    if (Test-Docker) {
        docker-compose down
        Write-Host "✅ すべてのサービスを停止しました" -ForegroundColor Green
    }
}

function Show-Logs {
    if (Test-Docker) {
        Write-Host "📄 Nakamaのログを表示します (終了: Ctrl+C)" -ForegroundColor Yellow
        docker-compose logs -f nakama
    }
}

# メイン処理
switch ($Mode) {
    "all" {
        Start-Backend
        Write-Host ""
        Start-Frontend
    }
    "backend" {
        Start-Backend
    }
    "frontend" {
        Start-Frontend
    }
    "stop" {
        Stop-Services
    }
    "logs" {
        Show-Logs
    }
    "-help" {
        Show-Help
    }
    "--help" {
        Show-Help
    }
    default {
        Write-Host "❌ 不明なオプション: $Mode" -ForegroundColor Red
        Write-Host "使用方法: .\start.ps1 [all|backend|frontend|stop|logs|-help]" -ForegroundColor Yellow
        exit 1
    }
}