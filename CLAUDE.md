# Quoridor Chess Online プロジェクトコンテキスト

## プロジェクト概要
Quoridor Chessのオンライン対戦ゲーム。Nakama Open Sourceを使用したWebSocketリアルタイム通信による2人対戦ゲーム。

### 開発状況
- **フェーズ1（完了）**: 基盤構築、認証、マッチメイキング、チャット機能
- **フェーズ2（開発中）**: ゲームボード実装、ゲームロジック
- **フェーズ3（計画中）**: 高度な機能、最適化

## 技術スタック
- **バックエンド**: Nakama Open Source (Go modules)
- **フロントエンド**: React + TypeScript + Vite
- **通信**: WebSocket (Nakama JS Client)
- **データベース**: PostgreSQL (Nakama内蔵)

## プロジェクト構造
```
quoridor-chess-demo/
├── .gitignore              # Git除外設定
├── README.md               # プロジェクト説明
├── CLAUDE.md               # 開発者向けコンテキスト（このファイル）
├── GAME_RULES.md           # Quoridorゲームルール詳細
├── docker-compose.yml      # Nakama + PostgreSQL構成
├── start.sh/ps1/bat        # 各OS対応起動スクリプト
├── backend/
│   ├── Dockerfile          # Goモジュールビルド用
│   ├── data/
│   │   ├── config.yml      # Nakama本番設定
│   │   └── config-minimal.yml # Nakama開発設定
│   └── modules/
│       ├── go.mod          # Go依存関係管理
│       └── main.go         # カスタムゲームロジック（296行、日本語コメント付）
└── frontend/
    ├── index.html          # HTMLエントリーポイント
    ├── package.json        # npm依存関係とスクリプト
    ├── vite.config.ts      # Viteビルド設定
    ├── tsconfig.json       # TypeScript設定
    ├── tsconfig.node.json  # Node.js用TypeScript設定
    └── src/
        ├── main.tsx        # Reactアプリエントリー（日本語コメント付）
        ├── App.tsx         # メインアプリコンポーネント（78行、日本語コメント付）
        ├── App.css         # アプリ全体のスタイル
        ├── index.css       # グローバルスタイル
        ├── components/     # Reactコンポーネント群
        │   ├── Login.tsx   # ログインフォーム（50行、日本語コメント付）
        │   ├── Login.css   # ログインスタイル
        │   ├── MatchmakingRoom.tsx # マッチメイキング（95行、日本語コメント付）
        │   ├── MatchmakingRoom.css # マッチメイキングスタイル
        │   ├── GameRoom.tsx        # ゲームルーム（443行、日本語コメント付）
        │   └── GameRoom.css        # ゲームルームスタイル
        └── utils/
            └── nakama.ts   # Nakamaクライアントサービス（139行、日本語コメント付）
```

## 実装済み機能
1. ✅ **プロジェクト基盤**
   - ゲームルール定義（GAME_RULES.md）
   - プロジェクト構造とビルドシステム
   - Docker化された開発環境
   - 全プラットフォーム対応起動スクリプト

2. ✅ **バックエンド（Nakama + Go）**
   - Nakamaサーバー設定とカスタムモジュール
   - WebSocketベースのリアルタイム通信
   - マッチ作成・参加・管理システム
   - プレイヤー認証（デバイスIDベース）
   - ゲーム状態の同期管理

3. ✅ **フロントエンド（React + TypeScript）**
   - モダンなReact 18 + Vite構成
   - TypeScriptによる型安全な開発
   - レスポンシブなUI設計
   - 状態管理とルーティング

4. ✅ **ユーザー体験**
   - 直感的な日本語UI
   - プライベートマッチ作成・参加
   - リアルタイムチャット機能
   - プレイヤー参加・退出の視覚的フィードバック

5. ✅ **開発体験**
   - 全ファイルに詳細な日本語コメント
   - 包括的なREADME.mdとドキュメント
   - .gitignore設定とプロジェクト整理
   - トラブルシューティングガイド

## 未実装機能（開発ロードマップ）

### 🎯 フェーズ2: ゲームコア機能（次の優先実装）
1. **ゲームボードUI**
   - 9×9グリッドの視覚的表示
   - プレイヤーコマの表示
   - 壁の視覚的表現
   - インタラクティブなクリック・ドラッグ操作

2. **基本ゲームロジック**
   - コマ移動の実装（1マス移動）
   - 壁配置機能とUI
   - ターン制の同期とタイマー
   - 基本的な移動バリデーション

3. **ゲーム進行管理**
   - ゲーム開始・終了処理
   - 勝利条件の判定
   - ゲーム状態のリアルタイム同期

### 🚀 フェーズ3: 高度な機能
4. **高度なルール**
   - ジャンプ移動の実装
   - 複雑な移動パターン（連続ジャンプ）
   - 壁配置の高度なバリデーション

5. **経路探索・AI**
   - 経路探索アルゴリズム（A*またはDijkstra）
   - 壁配置時の到達可能性チェック
   - 簡単なAI対戦相手（オプション）

6. **ユーザー体験向上**
   - ランダムマッチメイキング
   - 観戦モード
   - ゲーム履歴・統計
   - リプレイ機能

## 重要な実装詳細

### Nakamaマッチハンドラー (backend/modules/main.go)
**主要な構造体:**
- `QuoridorChessMatch`: マッチの状態管理、WebSocketイベント処理
- `GameState`: ゲーム状態（プレイヤー、ボード、ターン、勝者）
- `Player`: プレイヤー情報（ID、名前、位置、壁数、色）
- `Board`: 9×9ボードと配置済み壁の管理
- `Wall`: 壁の位置と方向（水平・垂直）

**WebSocketメッセージタイプ:**
- `player_joined`: プレイヤー参加通知
- `player_left`: プレイヤー退出通知  
- `game_started`: ゲーム開始通知（2人揃った時）
- `chat`: チャットメッセージ（OpCode 2）
- `move`: コマ移動（未実装、将来のOpCode 3）
- `place_wall`: 壁配置（未実装、将来のOpCode 4）
- `game_state_update`: ゲーム状態更新
- `match_terminated`: マッチ終了通知

**Match Interfaceメソッド:**
- `MatchInit`: マッチ初期化、9×9ボード作成
- `MatchJoinAttempt`: 参加可否判定（最大2人）
- `MatchJoin`: プレイヤー参加処理、色・開始位置設定
- `MatchLeave`: プレイヤー退出処理
- `MatchLoop`: メインゲームループ、メッセージ処理
- `MatchTerminate`: マッチ終了処理
- `MatchSignal`: 外部シグナル処理（未使用）

### フロントエンド状態管理
**メインアプリ状態 (App.tsx):**
- `AppState`: 'login' | 'matchmaking' | 'game' の画面遷移
- `username`: ログイン中のユーザー名
- `gameState`: マッチID、プレイヤー情報、作成者フラグ

**Nakamaサービス (utils/nakama.ts):**
- `nakamaService`: シングルトンパターンのサービスクラス
- 認証管理: デバイスIDベースの自動認証
- WebSocket接続: リアルタイム通信の管理
- マッチ操作: 作成、参加、データ送信
- エラーハンドリング: 接続失敗時のフォールバック

**ゲームルーム状態 (GameRoom.tsx):**
- `chatMessages`: チャット履歴の管理
- `gameState`: サーバーから受信したゲーム状態
- `players`: プレイヤー一覧（UI表示用）
- WebSocketイベント処理: 参加・退出・チャット・ゲーム状態更新

### ゲームルール要点
- 9×9ボード
- 各プレイヤー10枚の壁
- 開始位置: e1 (白), e9 (黒)
- 勝利条件: 相手側端への到達

## 開発時の注意事項

### 🐳 Docker環境
1. **必須サービス**: docker-compose.ymlでNakama+PostgreSQLを起動
2. **データ永続化**: PostgreSQLデータはDocker volumeで管理
3. **設定ファイル**: backend/data/config-minimal.yml を使用
4. **ログ確認**: `docker-compose logs -f nakama` でデバッグ

### 🔧 開発サーバー
1. **ポート構成**:
   - Frontend Dev Server: 3000 (Vite)
   - Nakama WebSocket: 7350
   - Nakama HTTP API: 7351
   - Nakama Console: 7351 (admin/password)
   - PostgreSQL: 5432 (内部)

2. **Go Modules**: 
   - backend/modulesで`go mod download`実行
   - Dockerビルド時に自動実行

3. **フロントエンド**:
   - `npm install`で依存関係インストール
   - Viteのホットリロード対応
   - TypeScript型チェック有効

### 🔐 認証システム
1. **Custom ID認証**: `ユーザー名:パスワード` 形式のCustom IDを使用
2. **新規登録**: `authenticateCustom(customId, true)` で新規アカウント作成
3. **ログイン**: `authenticateCustom(customId, false)` で既存アカウント認証
4. **パスワード要件**: 最小6文字以上
5. **セッション管理**: Nakamaセッションによる状態管理
6. **デバッグ用**: `nakamaService.clearSession()`でログアウト

## デバッグ・トラブルシューティング

### 🔍 ログとモニタリング
- **Nakamaコンソール**: http://localhost:7351 (admin/password)
  - マッチ一覧、プレイヤー状態、システム統計
- **Dockerログ**: `docker-compose logs -f nakama postgres`
- **ブラウザ開発者ツール**: WebSocket通信、エラー、ネットワーク
- **フロントエンドログ**: コンソールに詳細なデバッグ情報出力

### 🚨 よくある問題と解決策
1. **「No socket connection」エラー**
   - Nakamaサーバーの起動確認
   - ポート7350の接続確認
   - Docker コンテナの状態確認

2. **マッチ参加失敗**
   - マッチIDの形式確認（UUID + オプション末尾ピリオド）
   - マッチの存在確認（Nakamaコンソール）
   - 最大2人制限の確認

3. **チャットが表示されない**
   - WebSocket接続状態の確認
   - OpCode（1: システム、2: チャット）の確認
   - JSON形式エラーの確認

4. **フロントエンドビルドエラー**
   - `rm -rf node_modules package-lock.json && npm install`
   - TypeScriptエラーの確認
   - Vite設定の確認

## 次の開発ステップ（推奨順序）

### 🎯 優先度1: ゲームボード基盤
1. **BoardComponent.tsx作成**
   - 9×9グリッドの描画
   - CSS Grid/Flexboxレイアウト
   - プレイヤーコマの表示
   - 基本的なクリックイベント

2. **ゲーム状態の可視化**
   - プレイヤー位置の表示
   - 現在のターン表示
   - 残り壁数の表示

### 🎯 優先度2: 基本インタラクション
3. **コマ移動UI**
   - 移動可能マスのハイライト
   - クリック/ドラッグによる移動操作
   - 移動アニメーション

4. **サーバー連携**
   - 移動データの送信（OpCode 3）
   - サーバーでの移動バリデーション
   - 全プレイヤーへの状態同期

### 🎯 優先度3: 壁配置機能
5. **壁配置UI**
   - 壁配置モードの実装
   - 配置予定位置のプレビュー
   - 水平・垂直壁の選択

6. **壁配置ロジック**
   - サーバーでの配置バリデーション
   - 重複チェック、残数チェック
   - 経路ブロック禁止チェック（基本版）

### 🎯 優先度4: ゲーム進行
7. **ターン制実装**
   - ターン切り替えロジック
   - タイマー機能（オプション）
   - 無効操作の防止

8. **勝利判定**
   - 目標ライン到達の検出
   - ゲーム終了処理
   - 結果表示とリセット機能

### 📚 実装時の参考情報
- **Quoridorルール**: GAME_RULES.md詳細参照
- **既存コード**: 全ファイルに日本語コメント完備
- **アーキテクチャ**: WebSocket双方向通信で状態同期
- **デバッグ**: Nakamaコンソールで状態確認可能

## プロジェクト品質指標

### 📊 コード品質
- **総行数**: 約1,040行（コメント含む）
- **日本語コメント率**: 100%（全ファイル対応）
- **TypeScript導入率**: 100%（フロントエンド）
- **エラーハンドリング**: WebSocket切断、認証失敗、マッチ参加失敗に対応

### 🏗️ アーキテクチャ品質
- **分離性**: フロントエンド・バックエンド完全分離
- **スケーラビリティ**: Nakama分散対応、Docker化
- **保守性**: コンポーネント分離、サービス層分離
- **テスタビリティ**: モジュール化された構造

### 🔧 開発体験
- **セットアップ時間**: 5分以内（Docker利用）
- **ホットリロード**: フロントエンド対応
- **デバッグ環境**: 包括的なログとコンソール
- **ドキュメント**: README、CLAUDE.md、GAME_RULES.mdの3層構造