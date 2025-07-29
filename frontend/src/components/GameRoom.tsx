// Quoridor Chess ゲームルームコンポーネント
// リアルタイムマルチプレイヤーゲームのメイン画面
// マッチ管理、チャット機能、ゲーム状態表示を担当
import React, { useState, useEffect, useRef } from 'react';
import { nakamaService } from '../utils/nakama';
import './GameRoom.css';

// GameRoomProps - ゲームルームコンポーネントのプロパティ型定義
interface GameRoomProps {
  matchId: string;    // 参加するマッチの一意識別子
  username: string;   // プレイヤーの表示名
  isCreator: boolean; // マッチ作成者かどうかのフラグ
  onLeave: () => void; // ゲームルーム退出時のコールバック関数
}

// ChatMessage - チャットメッセージの型定義
interface ChatMessage {
  id: string;        // メッセージの一意識別子
  username: string;  // 送信者のユーザー名
  message: string;   // メッセージ内容
  timestamp: number; // 送信時刻（Unix時刻）
}

// Player - プレイヤー情報の型定義（Goサーバーからの受信データに対応）
interface Player {
  id: string;                           // プレイヤーのユーザーID
  username: string;                     // プレイヤーの表示名
  position: { x: number; y: number };   // ボード上の現在位置
  walls: number;                        // 残り壁数
  color: string;                        // プレイヤーの色（"white" または "black"）
}

// GameState - ゲーム全体の状態型定義（Goサーバーからの受信データに対応）
interface GameState {
  players: { [key: string]: Player }; // プレイヤー情報のマップ（ユーザーID -> Player）
  board: {                           // ゲームボード情報
    size: number;                    // ボードサイズ（9x9）
    walls: any[];                    // 配置済み壁のリスト
  };
  current_turn: string;              // 現在のターンのプレイヤーID
  winner: string;                    // 勝者のプレイヤーID（ゲーム終了時）
  game_started: boolean;             // ゲーム開始済みフラグ
}

// GameRoom メインコンポーネント - リアルタイムマルチプレイヤーゲームの中心
const GameRoom: React.FC<GameRoomProps> = ({ matchId, username, isCreator, onLeave }) => {
  // State管理 - チャット、ゲーム状態、UI制御
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]); // チャットメッセージ履歴
  const [inputMessage, setInputMessage] = useState('');                // チャット入力フィールド
  const [gameState, setGameState] = useState<GameState | null>(null);  // ゲーム状態（サーバーから受信）
  const [players, setPlayers] = useState<Player[]>([]);               // プレイヤー一覧（UI表示用）
  const chatEndRef = useRef<HTMLDivElement>(null);                    // チャット自動スクロール用
  const hasInitialized = useRef<boolean>(false);                      // 初期化重複防止フラグ

  // メインエフェクト - WebSocket接続とマッチイベントハンドラーの設定
  useEffect(() => {
    const socket = nakamaService.getSocket();
    if (!socket) {
      console.error('No socket connection');
      return;
    }
    
    console.log('Setting up match handlers for match:', matchId);
    console.log('User role:', isCreator ? 'Creator' : 'Joiner');
    console.log('Current username in GameRoom:', username);
    
    // initializeMatch - マッチ初期化処理（作成者と参加者で処理を分岐）
    const initializeMatch = async () => {
      if (hasInitialized.current) {
        console.log('Already initialized, skipping...');
        return;
      }
      hasInitialized.current = true;
      
      if (isCreator) {
        // 作成者の場合 - 既にマッチに参加済みなので追加の参加処理は不要
        addSystemMessage('マッチを作成しました。他のプレイヤーの参加を待っています。');
        console.log('Creator mode - already in match');
      } else {
        // 参加者の場合 - マッチに参加を試行し、他プレイヤーに通知
        try {
          console.log('Attempting to join match:', matchId);
          const match = await nakamaService.joinMatch(matchId);
          console.log('Successfully joined match:', match);
          
          if (match && match.match_id) {
            addSystemMessage(`マッチに参加しました (プレイヤー数: ${match.size})`);
            
            // 他のプレイヤーに参加を通知（OpCode 1: システム通知）
            try {
              await nakamaService.sendMatchData(matchId, 1, {
                type: 'player_joined',
                username: username,
                timestamp: Date.now()
              });
              console.log('Sent join notification to other players');
            } catch (notifyError) {
              console.log('Failed to notify other players of join:', notifyError);
            }
          } else {
            throw new Error('Invalid match response');
          }
        } catch (error) {
          // マッチ参加エラーハンドリング - ローカル環境でのフォールバック対応
          console.error('Match join failed:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          
          if (error.code === 3) {
            addSystemMessage(`マッチが見つかりません (${error.message})。ローカル環境として動作します。`);
            console.log('Running in local mode - messages will not be shared');
          } else {
            addSystemMessage(`マッチへの参加に失敗しました (${error.message})。ローカル環境として動作します。`);
          }
        }
      }
    };
    
    initializeMatch();

    // onmatchdata - サーバーからのマッチデータ受信ハンドラー
    // OpCodeに応じてシステム通知、チャット、ゲーム状態更新を処理
    socket.onmatchdata = (matchData) => {
      console.log('Received match data:', matchData);
      console.log('OpCode:', matchData.op_code);
      console.log('Data type:', typeof matchData.data);
      console.log('Raw data:', matchData.data);
      
      // OpCode 1（システム通知）またはOpCode 2（チャット）の専用処理
      if (matchData.op_code === 1 || matchData.op_code === 2) {
        let messageData;
        try {
          // バイナリデータをテキストに変換してJSONパース
          const textData = new TextDecoder().decode(matchData.data);
          messageData = JSON.parse(textData);
          console.log('Decoded message data:', messageData);
        } catch (e) {
          console.error('Failed to parse message data:', e);
          return;
        }
        
        // チャットメッセージ処理（OpCode 2）
        if (messageData.type === 'chat' && matchData.op_code === 2) {
          const newMessage: ChatMessage = {
            id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            username: matchData.username || messageData.username || '匿名',
            message: messageData.message,
            timestamp: messageData.timestamp || Date.now()
          };
          setChatMessages(prev => [...prev, newMessage]);
          return;
        }
        
        // プレイヤー参加通知処理（OpCode 1）
        if (messageData.type === 'player_joined' && matchData.op_code === 1) {
          if (messageData.username && messageData.username !== username) {
            console.log('Processing join notification for:', messageData.username);
            addSystemMessage(`${messageData.username}が参加しました`);
          }
          return;
        }
        
        // プレイヤー退出通知処理（OpCode 1）
        if (messageData.type === 'player_left' && matchData.op_code === 1) {
          if (messageData.username && messageData.username !== username) {
            addSystemMessage(`${messageData.username}が退出しました`);
          }
          return;
        }
      }
      
      // その他のメッセージの汎用処理（ゲーム状態更新など）
      let data;
      try {
        if (typeof matchData.data === 'object') {
          data = matchData.data;
        } else {
          const textData = new TextDecoder().decode(matchData.data);
          data = JSON.parse(textData);
        }
      } catch (e) {
        console.error('Failed to parse match data:', e);
        return;
      }
      
      // メッセージタイプ別処理分岐
      switch (data.type) {
        case 'player_joined':
          // プレイヤー参加通知（重複チェック付き）
          if (data.username && data.username !== username) {
            addSystemMessage(`${data.username}が参加しました`);
            console.log('Received join notification for:', data.username);
          }
          break;
        case 'player_left':
          // プレイヤー退出通知
          if (data.username && data.username !== username) {
            addSystemMessage(`${data.username}が退出しました`);
          }
          break;
        case 'game_started':
          // ゲーム開始通知 - ゲーム状態を更新
          setGameState(data.data);
          break;
        case 'chat':
          // チャットメッセージ（レガシー処理）
          handleChatMessage(data.data);
          break;
        case 'game_state_update':
          // ゲーム状態更新（コマ移動、壁配置後など）
          setGameState(data.data);
          break;
      }
    };

    // onmatchpresence - プレイヤーの参加・退出を監視するハンドラー
    // WebSocket接続レベルでの参加・退出を検知
    socket.onmatchpresence = (matchPresence) => {
      console.log('Match presence update:', matchPresence);
      console.log('Match presence joins:', matchPresence.joins);
      console.log('Match presence leaves:', matchPresence.leaves);
      
      // 新しいプレイヤーの参加処理
      if (matchPresence.joins && matchPresence.joins.length > 0) {
        console.log('Processing joins...');
        matchPresence.joins.forEach((presence, index) => {
          console.log(`Join ${index}:`, presence);
          console.log('Presence username:', presence.username);
          console.log('Current username:', username);
          console.log('Are they different?', presence.username !== username);
          
          if (presence.username !== username) { // 自分以外の参加者のみ通知
            console.log('Adding join message for:', presence.username);
            addSystemMessage(`${presence.username}が参加しました`);
          } else {
            console.log('Skipping own join message'); // 自分の参加は通知しない
          }
        });
      } else {
        console.log('No joins to process');
      }
      
      // プレイヤーの退出処理
      if (matchPresence.leaves && matchPresence.leaves.length > 0) {
        matchPresence.leaves.forEach(presence => {
          console.log('Player left:', presence);
          if (presence.username !== username) { // 自分以外の退出者のみ通知
            addSystemMessage(`${presence.username}が退出しました`);
          }
        });
      }
    };

    // クリーンアップ関数 - コンポーネントアンマウント時の処理
    return () => {
      // WebSocketイベントハンドラーをクリア（メモリリーク防止）
      if (socket) {
        socket.onmatchdata = null;
        socket.onmatchpresence = null;
      }
      // 初期化フラグをリセット（再マウント時の重複初期化防止）
      hasInitialized.current = false;
    };
  }, [matchId, isCreator]);

  // チャットメッセージ更新時の自動スクロール
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // handlePlayerJoined - プレイヤー参加時の処理（レガシー関数）
  // 現在は上記のonmatchdataハンドラーで処理されている
  const handlePlayerJoined = (data: any) => {
    console.log('Player joined:', data);
    if (data.game_state) {
      setGameState(data.game_state);
      const playersList = Object.values(data.game_state.players) as Player[];
      setPlayers(playersList);
    }
    
    addSystemMessage(`${data.player.username}が参加しました`);
  };

  // handlePlayerLeft - プレイヤー退出時の処理（レガシー関数）
  const handlePlayerLeft = (data: any) => {
    console.log('Player left:', data);
    addSystemMessage(`プレイヤーが退出しました`);
  };

  // handleChatMessage - チャットメッセージ受信処理（レガシー関数）
  const handleChatMessage = (data: any) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      username: data.username,
      message: data.message,
      timestamp: data.timestamp
    };
    setChatMessages(prev => [...prev, newMessage]);
  };

  // addSystemMessage - システムメッセージをチャットに追加
  // プレイヤー参加・退出、ゲーム状態変更などの通知に使用
  const addSystemMessage = (message: string) => {
    console.log('Adding system message:', message);
    const systemMessage: ChatMessage = {
      id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username: 'システム',
      message,
      timestamp: Date.now()
    };
    setChatMessages(prev => {
      console.log('Current chat messages:', prev);
      const newMessages = [...prev, systemMessage];
      console.log('New chat messages:', newMessages);
      return newMessages;
    });
  };

  // scrollToBottom - チャットエリアを最下部に自動スクロール
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // handleSendMessage - チャットメッセージ送信処理
  // OpCode 2でサーバーに送信し、即座にローカルUIにも表示
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    console.log('Sending message to match:', matchId);
    console.log('Message:', inputMessage.trim());
    
    try {
      // 送信と同時に自分のメッセージをローカルに表示（即座のフィードバック）
      const myMessage: ChatMessage = {
        id: `my_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username: `${username} (自分)`,
        message: inputMessage.trim(),
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, myMessage]);
      
      // サーバーに送信（OpCode 2: チャット）
      try {
        await nakamaService.sendMatchData(matchId, 2, {
          type: 'chat',
          username: username,
          message: inputMessage.trim(),
          timestamp: Date.now()
        });
        console.log('Match data sent successfully');
      } catch (matchError) {
        console.error('Match data send failed:', matchError);
      }
      
      setInputMessage(''); // 入力フィールドをクリア
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // handleLeaveMatch - マッチから退出する処理
  // 他のプレイヤーに退出を通知してからWebSocketマッチから離脱
  const handleLeaveMatch = async () => {
    try {
      const socket = nakamaService.getSocket();
      if (socket) {
        addSystemMessage(`${username}が退出しました`);
        
        // 他のプレイヤーに退出を通知（OpCode 1: システム通知）
        try {
          await nakamaService.sendMatchData(matchId, 1, {
            type: 'player_left',
            username: username,
            timestamp: Date.now()
          });
        } catch (notifyError) {
          console.log('Failed to notify other players:', notifyError);
        }
        
        // WebSocketマッチから離脱
        await socket.leaveMatch(matchId);
      }
    } catch (error) {
      console.error('Failed to leave match:', error);
    }
  };

  // handleLeaveGame - ゲーム退出処理（UIコールバック付き）
  const handleLeaveGame = () => {
    handleLeaveMatch();  // マッチから退出
    onLeave();          // 親コンポーネントに退出を通知
  };

  // JSXレンダリング - ゲームルームUI
  return (
    <div className="game-room container">
      {/* ヘッダー部分 - タイトル、マッチID、退出ボタン */}
      <div className="game-header">
        <h2>ゲームルーム</h2>
        <p className="match-id">マッチID: {matchId}</p>
        <button onClick={handleLeaveGame} className="leave-button">
          退出
        </button>
      </div>

      <div className="game-content">
        {/* ゲームエリア - ゲーム状態とボード表示 */}
        <div className="game-area">
          {/* ゲーム状態表示 */}
          <div className="game-status">
            {gameState ? (
              <>
                <h3>ゲーム状態</h3>
                <p>ゲーム開始: {gameState.game_started ? 'はい' : 'いいえ'}</p>
                <p>現在のターン: {gameState.current_turn || '待機中'}</p>
                <div className="players-info">
                  <h4>プレイヤー</h4>
                  {players.map(player => (
                    <div key={player.id} className={`player-info ${player.color}`}>
                      <span>{player.username}</span>
                      <span>壁: {player.walls}枚</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p>ゲーム情報を読み込み中...</p>
            )}
          </div>
          
          {/* ゲームボードプレースホルダー - 将来的にQuoridorボードを表示 */}
          <div className="game-board-placeholder">
            <p>ゲームボードはここに表示されます</p>
            <p className="todo-note">（次のステップで実装）</p>
          </div>
        </div>

        {/* チャットエリア - リアルタイムチャット機能 */}
        <div className="chat-area">
          <h3>チャット</h3>
          {/* チャットメッセージ表示エリア */}
          <div className="chat-messages">
            {chatMessages.map(msg => {
              const isSystem = msg.username === 'システム';
              const isMyMessage = msg.username.includes(`${username} (自分)`);
              const messageClass = isSystem ? 'system' : (isMyMessage ? 'my-message' : 'other-message');
              
              return (
                <div 
                  key={msg.id} 
                  className={`chat-message ${messageClass}`}
                >
                  {isSystem ? (
                    // システムメッセージ（プレイヤー参加・退出通知など）
                    <span className="chat-text">{msg.message}</span>
                  ) : (
                    // 通常のチャットメッセージ（ユーザー名付き）
                    <>
                      <span className="chat-username">{msg.username}:</span>
                      <span className="chat-text">{msg.message}</span>
                    </>
                  )}
                </div>
              );
            })}
            {/* 自動スクロール用の参照要素 */}
            <div ref={chatEndRef} />
          </div>
          
          {/* チャット入力フォーム */}
          <form onSubmit={handleSendMessage} className="chat-input-form">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="メッセージを入力..."
              className="chat-input"
            />
            <button type="submit" className="send-button">
              送信
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// GameRoomコンポーネントをデフォルトエクスポート
export default GameRoom;