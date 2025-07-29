#!/bin/bash

echo "==================================="
echo "Quoridor Chess Online 起動スクリプト"
echo "==================================="

# 起動モードの選択
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "使用方法: ./start.sh [オプション]"
    echo ""
    echo "オプション:"
    echo "  all       - バックエンドとフロントエンドを両方起動（デフォルト）"
    echo "  backend   - Nakamaバックエンドのみ起動"
    echo "  frontend  - フロントエンドのみ起動"
    echo "  stop      - すべてのサービスを停止"
    echo "  logs      - Nakamaのログを表示"
    echo "  --help    - このヘルプを表示"
    exit 0
fi

MODE=${1:-all}

# Dockerの確認
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Dockerがインストールされていません。"
        echo "Docker Desktopをインストールしてください: https://www.docker.com/products/docker-desktop"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo "❌ Dockerが起動していません。"
        echo "Docker Desktopを起動してください。"
        exit 1
    fi
}

# バックエンドの起動
start_backend() {
    echo "🚀 Nakamaバックエンドを起動しています..."
    check_docker
    
    # Go依存関係のダウンロード
    echo "📦 Go依存関係をダウンロード中..."
    cd backend/modules
    go mod download 2>/dev/null || echo "⚠️  Go依存関係のダウンロードをスキップ（Goがインストールされていない可能性があります）"
    cd ../..
    
    # Docker Composeで起動
    docker-compose up -d
    
    echo "⏳ Nakamaサーバーの起動を待っています..."
    sleep 5
    
    # ヘルスチェック
    for i in {1..10}; do
        if curl -f http://localhost:7350/ &> /dev/null; then
            echo "✅ Nakamaバックエンドが起動しました！"
            echo "   - ゲームサーバー: http://localhost:7350"
            echo "   - 管理コンソール: http://localhost:7351 (admin/password)"
            break
        else
            echo "⏳ 起動確認中... ($i/10)"
            sleep 2
        fi
    done
}

# フロントエンドの起動
start_frontend() {
    echo "🚀 フロントエンドを起動しています..."
    
    # Node.jsの確認
    if ! command -v node &> /dev/null; then
        echo "❌ Node.jsがインストールされていません。"
        echo "Node.jsをインストールしてください: https://nodejs.org/"
        exit 1
    fi
    
    cd frontend
    
    # 依存関係のインストール
    if [ ! -d "node_modules" ]; then
        echo "📦 依存関係をインストール中..."
        npm install
    fi
    
    echo "✅ フロントエンドを起動しました！"
    echo "   - アプリケーション: http://localhost:3000"
    echo ""
    echo "🎮 ゲームの遊び方:"
    echo "   1. ブラウザで2つのタブを開く"
    echo "   2. それぞれ別のユーザー名でログイン"
    echo "   3. ランダムマッチを開始してマッチング"
    echo "   4. チャットで会話を楽しむ"
    echo ""
    echo "終了するには Ctrl+C を押してください"
    
    # フロントエンドサーバーを起動
    npm run dev
}

# サービスの停止
stop_services() {
    echo "🛑 サービスを停止しています..."
    check_docker
    docker-compose down
    echo "✅ すべてのサービスを停止しました"
}

# ログの表示
show_logs() {
    check_docker
    echo "📄 Nakamaのログを表示します (終了: Ctrl+C)"
    docker-compose logs -f nakama
}

# メイン処理
case $MODE in
    "all")
        start_backend
        echo ""
        start_frontend
        ;;
    "backend")
        start_backend
        ;;
    "frontend")
        start_frontend
        ;;
    "stop")
        stop_services
        ;;
    "logs")
        show_logs
        ;;
    *)
        echo "❌ 不明なオプション: $MODE"
        echo "使用方法: ./start.sh [all|backend|frontend|stop|logs|--help]"
        exit 1
        ;;
esac