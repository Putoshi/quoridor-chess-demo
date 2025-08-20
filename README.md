# Quoridor Chess Online

Quoridor Chessのオンライン対戦ゲームです。Nakama Open Sourceを使用してリアルタイムマルチプレイヤー機能を実装しています。

> 📝 **開発者向け**: プロジェクトの詳細なコンテキストは [CLAUDE.md](./CLAUDE.md) を参照してください。  
> 🎮 **ゲームルール**: 詳細なルールは [GAME_RULES.md](./GAME_RULES.md) を参照してください。

## セットアップ

### 前提条件
- Docker Desktop (Nakama + PostgreSQL用)
- Node.js (v18以上推奨)
- Git (プロジェクト取得用)

### 簡単起動

**Linux/Mac:**
```bash
./start.sh
```

**Windows (PowerShell):**
```powershell
.\start.ps1
```

**Windows (コマンドプロンプト):**
```cmd
start-win.bat
```

### 起動オプション

```bash
# すべてのサービスを起動（デフォルト）
./start.sh all

# バックエンドのみ起動
./start.sh backend

# フロントエンドのみ起動
./start.sh frontend

# サービスを停止
./start.sh stop

# ログを表示
./start.sh logs

# ヘルプ
./start.sh --help
```

### アクセスURL
- フロントエンド: http://localhost:3000
- Nakamaコンソール: http://localhost:7351 (admin/password)

## ゲームの遊び方

### 基本的な流れ
1. **ログイン**: ユーザー名を入力してゲームに参加
2. **マッチ作成**: 「プライベートマッチ作成」でマッチを作成
3. **マッチ共有**: 表示されたマッチIDを友達に共有
4. **マッチ参加**: 友達がマッチIDを入力して参加
5. **ゲーム開始**: 2人揃ったらゲームルームに移動
6. **チャット**: リアルタイムでコミュニケーション可能

### 現在の制限
- **マッチメイキング**: プライベートマッチのみ対応（ランダムマッチは未実装）
- **ゲームプレイ**: チャット機能のみ（ボードゲーム部分は開発中）

## 実装状況

### ✅ 実装済み機能
- **認証システム**: パスワードベース認証・新規登録機能
- **リアルタイム通信**: WebSocketによる双方向通信  
- **プライベートマッチ**: マッチ作成・参加・共有機能
- **ゲームルーム**: プレイヤー参加・退出の管理
- **チャット機能**: リアルタイムメッセージング
- **状態管理**: プレイヤー情報・ゲーム状態の同期
- **日本語対応**: 完全な日本語UI
- **コード品質**: 全ファイルに日本語コメント付与

### 🚧 開発中・今後実装予定
- **ゲームボード**: 9×9 Quoridor盤面の表示
- **コマ移動**: プレイヤーコマの移動ロジック
- **壁配置**: 壁の設置とバリデーション
- **ターン制**: プレイヤー間のターン管理
- **勝利判定**: ゲーム終了条件の判定
- **ジャンプ移動**: コマのジャンプルール実装
- **経路探索**: 壁配置時の到達可能性チェック
- **ランダムマッチ**: 自動マッチメイキング機能

## 技術構成

### アーキテクチャ
```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   React Client  │◄───────────────►│  Nakama Server  │
│   (TypeScript)  │                 │   (Go modules)  │
└─────────────────┘                 └─────────────────┘
                                           │
                                           ▼
                                   ┌─────────────────┐
                                   │   PostgreSQL    │
                                   │   (Database)    │
                                   └─────────────────┘
```

### フロントエンド
- **React 18**: UIライブラリ
- **TypeScript**: 型安全性
- **Vite**: 高速ビルドツール
- **Nakama JS Client**: サーバー通信

### バックエンド
- **Nakama Open Source**: ゲームサーバー
- **Go**: カスタムゲームロジック
- **PostgreSQL**: データ永続化
- **Docker**: コンテナ化

## トラブルシューティング

### よくある問題

**ポートが使用中のエラー**
```bash
# 使用中のポートを確認
lsof -i :3000  # フロントエンド
lsof -i :7350  # Nakama Socket
lsof -i :7351  # Nakama Console

# プロセスを終了
kill -9 <PID>
```

**Dockerコンテナが起動しない**
```bash
# コンテナ状態確認
docker-compose ps

# ログを確認
docker-compose logs nakama
docker-compose logs postgres

# 完全リセット
docker-compose down -v
docker-compose up -d
```

**フロントエンドビルドエラー**
```bash
# 依存関係を再インストール
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### 開発環境のセットアップ
```bash
# リポジトリをクローン
git clone <repository-url>
cd quoridor-chess-demo

# 開発環境を起動
./start.sh

# 別ターミナルで開発サーバーを起動
cd frontend
npm run dev
```

