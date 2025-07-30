// Quoridor Chess オンライン対戦ゲーム - Nakamaサーバーモジュール
// このファイルはゲームのマッチメイキング、リアルタイム通信、ゲーム状態管理を担当
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

// ゲーム定数定義
const (
	MatchmakingTicket = "quoridor_chess" // マッチメイキングのチケット名
	MinPlayers        = 2               // 最小プレイヤー数（2人対戦）
	MaxPlayers        = 2               // 最大プレイヤー数（2人対戦）
)

// モジュール初期化関数 - Nakamaサーバー起動時に呼び出される
// マッチハンドラーとRPCハンドラーを登録
func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("Quoridor Chess module loaded!")

	// マッチハンドラーの登録 - ゲームマッチの作成と管理
	if err := initializer.RegisterMatch("quoridor_chess", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return &QuoridorChessMatch{}, nil
	}); err != nil {
		return err
	}

	// RPCハンドラーの登録 - クライアントから呼び出される機能
	// マッチメイキング参加
	if err := initializer.RegisterRpc("join_matchmaking", JoinMatchmaking); err != nil {
		return err
	}

	// マッチメイキング退出
	if err := initializer.RegisterRpc("leave_matchmaking", LeaveMatchmaking); err != nil {
		return err
	}

	// チャット送信
	if err := initializer.RegisterRpc("send_chat", SendChat); err != nil {
		return err
	}

	return nil
}

// QuoridorChessMatch - Matchインターフェースを実装するゲームマッチ構造体
// リアルタイムゲームセッションの状態とロジックを管理
type QuoridorChessMatch struct {
	presences  map[string]runtime.Presence // 接続中のプレイヤー一覧
	gameState  *GameState                  // ゲーム状態（盤面、プレイヤー情報など）
	tickRate   int                         // サーバーの更新頻度（Hz）
	label      *MatchLabel                 // マッチのメタデータ
}

// MatchLabel - マッチのメタデータ構造体
type MatchLabel struct {
	Open bool `json:"open"` // マッチが新規参加可能かどうか
}

// GameState - ゲーム全体の状態を管理する構造体
type GameState struct {
	Players      map[string]*Player `json:"players"`      // プレイヤー情報（ユーザーID -> Player）
	Board        *Board            `json:"board"`        // ゲームボード（壁の配置など）
	CurrentTurn  string            `json:"current_turn"`  // 現在のターンのプレイヤーID
	Winner       string            `json:"winner"`        // 勝者のプレイヤーID（ゲーム終了時）
	GameStarted  bool              `json:"game_started"`  // ゲームが開始されているかどうか
	CreatedAt    int64             `json:"created_at"`    // マッチ作成時刻（Unix時刻）
}

// Player - プレイヤー情報を保持する構造体
type Player struct {
	ID       string    `json:"id"`       // プレイヤーのユーザーID
	Username string    `json:"username"` // プレイヤーの表示名
	Position *Position `json:"position"` // 現在のボード上の位置
	Walls    int       `json:"walls"`    // 残り壁数（初期値10）
	Color    string    `json:"color"`    // プレイヤーの色（"white" または "black"）
}

// Position - ボード上の座標を表す構造体
type Position struct {
	X int `json:"x"` // X座標（0-8）
	Y int `json:"y"` // Y座標（0-8、白プレイヤーは8から開始、黒プレイヤーは0から開始）
}

// abs - 整数の絶対値を返す（ヘルパー関数）
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// Board - ゲームボードの状態を管理する構造体
type Board struct {
	Size      int    `json:"size"`  // ボードのサイズ（9x9）
	Walls     []Wall `json:"walls"` // 配置された壁のリスト
}

// Wall - 壁の情報を保持する構造体
type Wall struct {
	Start      *Position `json:"start"`      // 壁の開始座標
	End        *Position `json:"end"`        // 壁の終了座標
	Horizontal bool      `json:"horizontal"` // 水平壁かどうか（false の場合は垂直壁）
}

// =============================================================================
// Matchインターフェースのメソッド実装
// =============================================================================

// MatchInit - マッチ初期化時に呼び出される
// ゲーム状態、プレイヤー管理、ボード設定を初期化
func (m *QuoridorChessMatch) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	// プレイヤーの接続状態を管理するマップを初期化
	m.presences = make(map[string]runtime.Presence)
	// サーバーの更新頻度を設定（10Hz）
	m.tickRate = 10
	// ゲーム状態を初期化
	m.gameState = &GameState{
		Players:     make(map[string]*Player),          // プレイヤー情報を空で初期化
		Board:       &Board{Size: 9, Walls: []Wall{}}, // 9x9ボード、壁なしで初期化
		GameStarted: false,                           // ゲーム未開始状態
		CreatedAt:   time.Now().Unix(),               // 現在時刻を記録
	}
	
	// マッチラベルを設定（新規参加可能）
	labelJSON, _ := json.Marshal(&MatchLabel{Open: true})
	m.label = &MatchLabel{Open: true}
	
	return m.gameState, m.tickRate, string(labelJSON)
}

// MatchJoinAttempt - プレイヤーがマッチに参加しようとした時の処理
// 参加可能かどうかを判定（最大2人まで）
func (m *QuoridorChessMatch) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	// プレイヤー数が上限に達している場合は参加拒否
	if len(m.presences) >= MaxPlayers {
		return state, false, "Match is full"
	}
	// 参加許可
	return state, true, ""
}

// MatchJoin - プレイヤーがマッチに正式に参加した時の処理
// プレイヤー情報の設定、ゲーム開始判定を行う
func (m *QuoridorChessMatch) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	for _, presence := range presences {
		// プレイヤーの接続情報を記録
		m.presences[presence.GetUserId()] = presence
		
		// ゲーム状態にプレイヤーを追加
		playerNum := len(m.gameState.Players) + 1
		color := "white"  // 1人目は白
		startY := 8       // 白プレイヤーの開始位置（下端）
		if playerNum == 2 {
			color = "black" // 2人目は黒
			startY = 0      // 黒プレイヤーの開始位置（上端）
		}
		
		// プレイヤー情報を作成（中央のX=4、各プレイヤーの開始Y座標、壁10個）
		m.gameState.Players[presence.GetUserId()] = &Player{
			ID:       presence.GetUserId(),
			Username: presence.GetUsername(),
			Position: &Position{X: 4, Y: startY}, // ボード中央から開始
			Walls:    10,                         // 壁の初期数
			Color:    color,
		}
		
		// 他のプレイヤーにプレイヤー参加を通知
		msg := map[string]interface{}{
			"type": "player_joined",
			"data": map[string]interface{}{
				"player":     m.gameState.Players[presence.GetUserId()],
				"game_state": m.gameState,
			},
		}
		msgBytes, _ := json.Marshal(msg)
		dispatcher.BroadcastMessage(1, msgBytes, nil, nil, true)
		
		// 2人揃ったらゲーム開始
		if len(m.presences) == MaxPlayers && !m.gameState.GameStarted {
			m.gameState.GameStarted = true
			// 最初のプレイヤーのターンに設定
			for id := range m.gameState.Players {
				m.gameState.CurrentTurn = id
				break
			}
			
			// マッチラベルを更新（新規参加不可に変更）
			m.label.Open = false
			labelJSON, _ := json.Marshal(m.label)
			dispatcher.MatchLabelUpdate(string(labelJSON))
			
			// ゲーム開始をすべてのプレイヤーに通知
			startMsg := map[string]interface{}{
				"type": "game_started",
				"data": m.gameState,
			}
			startMsgBytes, _ := json.Marshal(startMsg)
			dispatcher.BroadcastMessage(1, startMsgBytes, nil, nil, true)
		}
	}
	
	return m.gameState
}

// MatchLeave - プレイヤーがマッチから退出した時の処理
// プレイヤー情報の削除、他プレイヤーへの通知を行う
func (m *QuoridorChessMatch) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	for _, presence := range presences {
		// プレイヤーの接続情報とゲーム状態から削除
		delete(m.presences, presence.GetUserId())
		delete(m.gameState.Players, presence.GetUserId())
		
		// 他のプレイヤーに退出を通知
		msg := map[string]interface{}{
			"type": "player_left",
			"data": map[string]interface{}{
				"player_id": presence.GetUserId(),
			},
		}
		msgBytes, _ := json.Marshal(msg)
		dispatcher.BroadcastMessage(1, msgBytes, nil, nil, true)
	}
	
	// プレイヤーが全員いなくなったらマッチ終了
	if len(m.presences) == 0 {
		return nil
	}
	
	return m.gameState
}

// MatchLoop - メインゲームループ、定期的に呼び出される
// プレイヤーからのメッセージ処理、ゲーム状態更新を行う
func (m *QuoridorChessMatch) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	// プレイヤーからのメッセージを処理
	for _, msg := range messages {
		var data map[string]interface{}
		if err := json.Unmarshal(msg.GetData(), &data); err != nil {
			continue // JSON解析エラーは無視
		}
		
		// メッセージタイプによって処理を分岐
		switch data["type"] {
		case "chat":
			// チャットメッセージをすべてのプレイヤーにブロードキャスト
			chatMsg := map[string]interface{}{
				"type": "chat",
				"data": map[string]interface{}{
					"sender_id": msg.GetUserId(),         // 送信者ID
					"username":  msg.GetUsername(),       // 送信者名
					"message":   data["message"],         // メッセージ内容
					"timestamp": time.Now().Unix(),       // 送信時刻
				},
			}
			chatMsgBytes, _ := json.Marshal(chatMsg)
			dispatcher.BroadcastMessage(2, chatMsgBytes, nil, nil, true)
			
		case "move":
			// コマ移動処理
			if !m.gameState.GameStarted {
				continue // ゲームが開始されていない場合は無視
			}
			
			// 自分のターンかチェック
			if msg.GetUserId() != m.gameState.CurrentTurn {
				continue // 自分のターンでない場合は無視
			}
			
			// 移動先の座標を取得
			position, ok := data["position"].(map[string]interface{})
			if !ok {
				continue
			}
			
			x, xOk := position["x"].(float64)
			y, yOk := position["y"].(float64)
			if !xOk || !yOk {
				continue
			}
			
			// プレイヤー情報を取得
			player := m.gameState.Players[msg.GetUserId()]
			if player == nil {
				continue
			}
			
			// 移動の妥当性をチェック（基本的な移動のみ）
			newX := int(x)
			newY := int(y)
			
			// ボード範囲内チェック
			if newX < 0 || newX > 8 || newY < 0 || newY > 8 {
				continue
			}
			
			// 基本的な隣接移動チェック（1マスのみ）
			dx := newX - player.Position.X
			dy := newY - player.Position.Y
			
			// 斜め移動は不可、1マスのみ移動可能
			if (dx != 0 && dy != 0) || (abs(dx) + abs(dy) != 1) {
				continue
			}
			
			// 移動実行
			player.Position.X = newX
			player.Position.Y = newY
			
			// 勝利判定
			if (player.Color == "white" && newY == 0) || (player.Color == "black" && newY == 8) {
				m.gameState.Winner = msg.GetUserId()
				m.gameState.GameStarted = false
			}
			
			// ターンを切り替え
			for id := range m.gameState.Players {
				if id != m.gameState.CurrentTurn {
					m.gameState.CurrentTurn = id
					break
				}
			}
			
			// ゲーム状態更新を全プレイヤーに通知
			updateMsg := map[string]interface{}{
				"type": "game_state_update",
				"data": m.gameState,
			}
			updateMsgBytes, _ := json.Marshal(updateMsg)
			dispatcher.BroadcastMessage(1, updateMsgBytes, nil, nil, true)
			
		case "place_wall":
			// TODO: 壁配置ロジックの実装
		}
	}
	
	return m.gameState
}

// MatchTerminate - マッチ終了時の処理
// プレイヤーにマッチ終了を通知
func (m *QuoridorChessMatch) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	// マッチ終了をすべてのプレイヤーに通知
	msg := map[string]interface{}{
		"type": "match_terminated",
		"data": map[string]interface{}{
			"reason": "Match ended",
		},
	}
	msgBytes, _ := json.Marshal(msg)
	dispatcher.BroadcastMessage(1, msgBytes, nil, nil, true)
	
	return state
}

// MatchSignal - 外部からのシグナル処理（現在未使用）
func (m *QuoridorChessMatch) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}

// =============================================================================
// RPCハンドラー - クライアントから直接呼び出される機能
// =============================================================================

// JoinMatchmaking - マッチメイキングに参加するRPC
// クライアントがマッチメイキングプールに参加要求を送信
func JoinMatchmaking(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	// この機能は現在無効化されており、クライアント側で直接マッチ作成・参加を行います
	return "{\"message\": \"matchmaking disabled, use create/join match directly\"}", nil
}

// LeaveMatchmaking - マッチメイキングから退出するRPC
// クライアントが指定したチケットでマッチメイキングプールから退出
func LeaveMatchmaking(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	// この機能は現在無効化されており、クライアント側で直接マッチを退出します
	return "{\"success\": true}", nil
}

// SendChat - チャットメッセージ送信RPC
// 実際の処理はMatchLoopで行われるため、ここでは成功レスポンスのみ返却
func SendChat(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	// チャット処理はMatchLoopで実行される
	return "{\"success\": true}", nil
}