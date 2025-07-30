// Quoridor Chess ゲームルームコンポーネント
// リアルタイムマルチプレイヤーゲームのメイン画面
// マッチ管理、チャット機能、ゲーム状態表示を担当
import React, { useState, useEffect, useRef } from 'react';
import { nakamaService } from '../utils/nakama';
import BoardComponent from './BoardComponent';
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

// Position - ボード上の位置を表す型
interface Position {
  x: number; // X座標（0-8）
  y: number; // Y座標（0-8）
}

// Player - プレイヤー情報の型定義（Goサーバーからの受信データに対応）
interface Player {
  id: string;                           // プレイヤーのユーザーID
  username: string;                     // プレイヤーの表示名
  position: Position;                   // ボード上の現在位置
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
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null); // 選択中のセル
  const [validMoves, setValidMoves] = useState<Position[]>([]);       // 移動可能な位置
  const [jumpMoves, setJumpMoves] = useState<Position[]>([]);         // ジャンプ移動の位置
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
        } catch (error: any) {
          // マッチ参加エラーハンドリング - ローカル環境でのフォールバック対応
          console.error('Match join failed:', error);
          console.error('Error code:', error?.code);
          console.error('Error message:', error?.message);
          
          if (error?.code === 3) {
            addSystemMessage(`マッチが見つかりません (${error?.message})。ローカル環境として動作します。`);
            console.log('Running in local mode - messages will not be shared');
          } else {
            addSystemMessage(`マッチへの参加に失敗しました (${error?.message})。ローカル環境として動作します。`);
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
            username: (matchData as any).username || messageData.username || '匿名',
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
        case 'start_game_request':
          // ゲーム開始リクエストの受信処理
          console.log('Received game start request:', data);
          if (data.player_id !== getCurrentPlayerId()) {
            // 他のプレイヤーからのゲーム開始リクエスト
            addSystemMessage(`${data.username}がゲーム開始を要求しています`);
            handleGameStartRequest(data);
          }
          break;
        case 'game_started':
          // ゲーム開始通知 - ゲーム状態を更新
          console.log('🎮 Received game_started message:', data);
          setGameState(data.data);
          if (data.data.players) {
            const playersList = Object.values(data.data.players) as Player[];
            setPlayers(playersList);
            console.log('✅ Game state synchronized for receiving player');
          }
          addSystemMessage('🎮 ゲームが開始されました！白のプレイヤーのターンです。');
          break;
        case 'move':
          // プレイヤー移動メッセージの受信処理
          console.log('Received move message:', data);
          if (data.player_id && data.position && gameState) {
            // 他のプレイヤーの移動を自分のゲーム状態に反映
            const updatedGameState = { ...gameState };
            if (updatedGameState.players[data.player_id]) {
              updatedGameState.players[data.player_id].position = data.position;
              // ターンを次のプレイヤーに切り替え
              const playerIds = Object.keys(updatedGameState.players);
              const currentIndex = playerIds.indexOf(updatedGameState.current_turn);
              const nextIndex = (currentIndex + 1) % playerIds.length;
              updatedGameState.current_turn = playerIds[nextIndex];
              
              // 勝利条件をチェック
              const winner = checkWinCondition(updatedGameState);
              if (winner) {
                updatedGameState.winner = winner;
                addSystemMessage(`🎉 ゲーム終了！ ${updatedGameState.players[winner]?.username} の勝利です！`);
              }
              
              setGameState(updatedGameState);
              setPlayers(Object.values(updatedGameState.players));
              
              const playerName = updatedGameState.players[data.player_id]?.username || 'プレイヤー';
              const posStr = `${String.fromCharCode(97 + data.position.x)}${9 - data.position.y}`;
              addSystemMessage(`${playerName} が ${posStr} へ移動しました`);
            }
          }
          break;
        case 'chat':
          // チャットメッセージ（レガシー処理）
          handleChatMessage(data.data);
          break;
        case 'game_state_update':
          // ゲーム状態更新（コマ移動、壁配置後など）
          setGameState(data.data);
          if (data.data.players) {
            const playersList = Object.values(data.data.players) as Player[];
            setPlayers(playersList);
          }
          // 移動後は選択状態をクリア
          setSelectedPosition(null);
          setValidMoves([]);
          // 勝者判定
          if (data.data.winner) {
            addSystemMessage(`ゲーム終了！ ${data.data.players[data.data.winner]?.username} の勝利です！`);
          }
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
          
          if (presence.username !== username) { // 自分以外の参加者のみ通知
            console.log('Adding join message for:', presence.username);
            addSystemMessage(`${presence.username}が参加しました`);
          } else {
            console.log('Skipping own join message'); // 自分の参加は通知しない
          }
        });
        
        // マッチの現在の状態を確認してゲーム開始を判定
        checkAndStartGame();
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
        socket.onmatchdata = () => {};
        socket.onmatchpresence = () => {};
      }
      // 初期化フラグをリセット（再マウント時の重複初期化防止）
      hasInitialized.current = false;
    };
  }, [matchId, isCreator]);

  // チャットメッセージ更新時の自動スクロール
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);


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

  // handleManualStartGame - 手動でゲームを開始
  const handleManualStartGame = async () => {
    const currentPlayerId = getCurrentPlayerId();
    if (!currentPlayerId) {
      addSystemMessage('プレイヤーIDが取得できません');
      return;
    }

    console.log('🎮 Starting game immediately');
    
    // 即座にデモモードでゲームを開始
    addSystemMessage('ゲームを開始します...');
    startGameDemo([{ user_id: currentPlayerId, username: username }]);
  };

  // handleGameStartRequest - 他プレイヤーからのゲーム開始リクエスト処理
  const handleGameStartRequest = (requestData: any) => {
    const currentPlayerId = getCurrentPlayerId();
    if (!currentPlayerId) {
      console.error('Current player ID not found');
      return;
    }

    // 2人のプレイヤーでゲームを開始
    const gamePresences = [
      { user_id: requestData.player_id, username: requestData.username },
      { user_id: currentPlayerId, username: username }
    ];

    console.log('🎮 Starting multiplayer game with:', gamePresences);
    startMultiplayerGame(gamePresences);
  };

  // checkAndStartGame - プレイヤー参加時の自動チェック
  const checkAndStartGame = async () => {
    console.log('🔍 Checking for automatic game start...');
    
    // 既にゲームが開始されている場合はスキップ
    if (gameState && gameState.game_started) {
      console.log('Game already started, skipping');
      return;
    }

    // 少し待ってからゲーム開始の判定を行う
    setTimeout(() => {
      addSystemMessage('ゲームを開始するには「ゲーム開始」ボタンを押してください');
      addSystemMessage('または、もう一人のプレイヤーが参加するまでお待ちください');
    }, 500);
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

  // startGame - ゲーム開始処理（2人揃った時に実行）
  const startGame = (allPresences: any[]) => {
    console.log('🎮 Initializing game with presences:', allPresences);
    
    const currentPlayerId = getCurrentPlayerId();
    if (!currentPlayerId) {
      console.error('Current player ID not found');
      return;
    }
    
    // 既にゲームが開始済みの場合は重複実行を防ぐ
    if (gameState && gameState.game_started) {
      console.log('Game already started, skipping...');
      return;
    }
    
    // 全プレイヤーIDを収集（現在のプレイヤー + 参加したプレイヤー）
    const allPlayerIds = new Set([currentPlayerId]);
    allPresences.forEach(presence => {
      if (presence.user_id) {
        allPlayerIds.add(presence.user_id);
      }
    });
    
    const playerIdArray = Array.from(allPlayerIds);
    console.log('All player IDs:', playerIdArray);
    
    // プレイヤー情報を作成（最初のプレイヤーが白、2番目が黒）
    const newPlayers: { [key: string]: Player } = {};
    
    playerIdArray.forEach((playerId, index) => {
      const isWhite = index === 0;
      const playerUsername = playerId === currentPlayerId ? username : 
        allPresences.find(p => p.user_id === playerId)?.username || `プレイヤー${index + 1}`;
      
      newPlayers[playerId] = {
        id: playerId,
        username: playerUsername,
        position: isWhite ? { x: 4, y: 8 } : { x: 4, y: 0 }, // 白: e9(4,8), 黒: e1(4,0)
        walls: 10,
        color: isWhite ? "white" : "black"
      };
    });
    
    // ゲーム状態を初期化（白プレイヤーから開始）
    const whitePlayerId = playerIdArray[0];
    const newGameState: GameState = {
      players: newPlayers,
      board: {
        size: 9,
        walls: []
      },
      current_turn: whitePlayerId, // 白プレイヤーから開始
      winner: '',
      game_started: true
    };
    
    console.log('🎯 Game state initialized:', newGameState);
    console.log('White player (first turn):', whitePlayerId);
    console.log('Players created:', Object.keys(newPlayers));
    
    // ゲーム状態を更新
    setGameState(newGameState);
    setPlayers(Object.values(newPlayers));
    
    // ゲーム開始メッセージを送信（他のプレイヤーに通知）
    nakamaService.sendMatchData(matchId, 1, {
      type: 'game_started',
      data: newGameState
    }).catch(error => {
      console.error('Failed to send game start message:', error);
    });
    
    addSystemMessage('🎮 ゲームが開始されました！白のプレイヤーのターンです。');
  };

  // startGameDemo - デモ用ゲーム開始（1人で両方のコマを操作可能）
  const startGameDemo = (presences: any[]) => {
    console.log('🎮 Initializing demo game');
    
    const currentPlayerId = getCurrentPlayerId();
    if (!currentPlayerId) {
      console.error('Current player ID not found');
      return;
    }
    
    // 既にゲームが開始済みの場合は重複実行を防ぐ
    if (gameState && gameState.game_started) {
      console.log('Game already started, skipping...');
      return;
    }
    
    // デモ用：2つのプレイヤーIDを作成（両方とも同じプレイヤーが操作）
    const whitePlayerId = currentPlayerId;
    const blackPlayerId = currentPlayerId + '_black'; // 仮想の黒プレイヤーID
    
    const newPlayers: { [key: string]: Player } = {};
    
    // 白プレイヤー（実際のプレイヤー）
    newPlayers[whitePlayerId] = {
      id: whitePlayerId,
      username: `${username} (白)`,
      position: { x: 4, y: 8 }, // e9
      walls: 10,
      color: "white"
    };
    
    // 黒プレイヤー（仮想プレイヤー、同じ人が操作）
    newPlayers[blackPlayerId] = {
      id: blackPlayerId,
      username: `${username} (黒)`,
      position: { x: 4, y: 0 }, // e1
      walls: 10,
      color: "black"
    };
    
    // ゲーム状態を初期化（白プレイヤーから開始）
    const newGameState: GameState = {
      players: newPlayers,
      board: {
        size: 9,
        walls: []
      },
      current_turn: whitePlayerId, // 白プレイヤーから開始
      winner: '',
      game_started: true
    };
    
    console.log('🎯 Demo game state initialized:', newGameState);
    console.log('Players created:', Object.keys(newPlayers));
    
    // ローカル状態を更新
    setGameState(newGameState);
    setPlayers(Object.values(newPlayers));
    
    addSystemMessage('🎮 デモゲーム開始！両方のコマを操作できます。白のターンから開始します。');
  };

  // startMultiplayerGame - 真のマルチプレイヤーゲーム開始
  const startMultiplayerGame = (presences: any[]) => {
    console.log('🎮 Initializing multiplayer game with presences:', presences);
    
    const currentPlayerId = getCurrentPlayerId();
    if (!currentPlayerId) {
      console.error('Current player ID not found');
      return;
    }
    
    // 既にゲームが開始済みの場合は重複実行を防ぐ
    if (gameState && gameState.game_started) {
      console.log('Game already started, skipping...');
      return;
    }
    
    // プレイヤーIDを決定（最初のプレイヤーが白、2番目が黒）
    const player1 = presences[0];
    const player2 = presences[1];
    
    const newPlayers: { [key: string]: Player } = {};
    
    // 1番目のプレイヤー（白）
    newPlayers[player1.user_id] = {
      id: player1.user_id,
      username: player1.username,
      position: { x: 4, y: 8 }, // e9
      walls: 10,
      color: "white"
    };
    
    // 2番目のプレイヤー（黒）
    newPlayers[player2.user_id] = {
      id: player2.user_id,
      username: player2.username,
      position: { x: 4, y: 0 }, // e1
      walls: 10,
      color: "black"
    };
    
    // ゲーム状態を初期化（白プレイヤーから開始）
    const newGameState: GameState = {
      players: newPlayers,
      board: {
        size: 9,
        walls: []
      },
      current_turn: player1.user_id, // 白プレイヤーから開始
      winner: '',
      game_started: true
    };
    
    console.log('🎯 Multiplayer game state initialized:', newGameState);
    console.log('White player:', player1.username, 'ID:', player1.user_id);
    console.log('Black player:', player2.username, 'ID:', player2.user_id);
    console.log('Current player:', currentPlayerId);
    
    // ローカル状態を更新
    setGameState(newGameState);
    setPlayers(Object.values(newPlayers));
    
    // 他のプレイヤーにゲーム開始状態を送信
    nakamaService.sendMatchData(matchId, 1, {
      type: 'game_started',
      data: newGameState
    }).catch(error => {
      console.error('Failed to send game start message:', error);
    });
    
    addSystemMessage('🎮 マルチプレイヤーゲーム開始！');
    addSystemMessage(`白: ${player1.username}, 黒: ${player2.username}`);
    addSystemMessage(`${newPlayers[newGameState.current_turn].username}のターンです`);
  };
  
  // getCurrentPlayerId - 現在のプレイヤーIDを取得
  const getCurrentPlayerId = (): string | null => {
    const session = nakamaService.getSession();
    return session?.user_id || null;
  };

  // checkWinCondition - 勝利条件をチェック
  const checkWinCondition = (gameState: GameState): string | null => {
    console.log('🏆 Checking win condition...');
    for (const [playerId, player] of Object.entries(gameState.players)) {
      console.log(`Player ${player.username} (${player.color}): position (${player.position.x}, ${player.position.y})`);
      
      // 白プレイヤー（y=8から開始）がy=0に到達したら勝利
      if (player.color === "white" && player.position.y === 0) {
        console.log(`🎉 WHITE WINS! Player: ${player.username}`);
        return playerId;
      }
      // 黒プレイヤー（y=0から開始）がy=8に到達したら勝利
      if (player.color === "black" && player.position.y === 8) {
        console.log(`🎉 BLACK WINS! Player: ${player.username}`);
        return playerId;
      }
    }
    console.log('No winner yet');
    return null;
  };
  
  // calculateValidMoves - 移動可能な位置を計算（ジャンプ移動対応）
  const calculateValidMoves = (position: Position): { normalMoves: Position[], jumpMoves: Position[] } => {
    const normalMoves: Position[] = [];
    const jumpMoves: Position[] = [];
    const directions = [
      { dx: 0, dy: -1 }, // 上
      { dx: 1, dy: 0 },  // 右
      { dx: 0, dy: 1 },  // 下
      { dx: -1, dy: 0 }  // 左
    ];
    
    console.log(`🔍 Calculating valid moves from (${position.x}, ${position.y})`);
    
    for (const dir of directions) {
      const adjacentX = position.x + dir.dx;
      const adjacentY = position.y + dir.dy;
      
      // ボード範囲内チェック
      if (adjacentX >= 0 && adjacentX <= 8 && adjacentY >= 0 && adjacentY <= 8) {
        // 隣接位置にプレイヤーがいるかチェック
        const adjacentPlayer = Object.values(gameState?.players || {}).find(
          player => player.position.x === adjacentX && player.position.y === adjacentY
        );
        
        if (!adjacentPlayer) {
          // 隣接位置が空いている場合、通常の移動
          normalMoves.push({ x: adjacentX, y: adjacentY });
          console.log(`✅ Normal move to (${adjacentX}, ${adjacentY})`);
        } else {
          // 隣接位置にプレイヤーがいる場合、ジャンプ移動を検討
          const jumpX = adjacentX + dir.dx;
          const jumpY = adjacentY + dir.dy;
          
          console.log(`🐸 Found player at (${adjacentX}, ${adjacentY}), checking jump to (${jumpX}, ${jumpY})`);
          
          // ジャンプ先がボード範囲内かチェック
          if (jumpX >= 0 && jumpX <= 8 && jumpY >= 0 && jumpY <= 8) {
            // ジャンプ先にプレイヤーがいないかチェック
            const jumpOccupied = Object.values(gameState?.players || {}).some(
              player => player.position.x === jumpX && player.position.y === jumpY
            );
            
            if (!jumpOccupied) {
              // TODO: 将来的に壁の判定を追加
              // 現在は壁がないので、ジャンプ移動を許可
              jumpMoves.push({ x: jumpX, y: jumpY });
              console.log(`✅ Jump move to (${jumpX}, ${jumpY})`);
            } else {
              console.log(`❌ Jump blocked - player at (${jumpX}, ${jumpY})`);
            }
          } else {
            console.log(`❌ Jump out of bounds (${jumpX}, ${jumpY})`);
            
            // ジャンプできない場合の斜め移動（Quoridorルール）
            // 左右または上下に移動可能な場合
            const diagonalDirections = [
              { dx: dir.dy, dy: dir.dx },   // 90度回転
              { dx: -dir.dy, dy: -dir.dx }  // -90度回転
            ];
            
            for (const diagDir of diagonalDirections) {
              const diagX = adjacentX + diagDir.dx;
              const diagY = adjacentY + diagDir.dy;
              
              if (diagX >= 0 && diagX <= 8 && diagY >= 0 && diagY <= 8) {
                const diagOccupied = Object.values(gameState?.players || {}).some(
                  player => player.position.x === diagX && player.position.y === diagY
                );
                
                if (!diagOccupied) {
                  jumpMoves.push({ x: diagX, y: diagY });
                  console.log(`✅ Diagonal move to (${diagX}, ${diagY})`);
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`🎯 Normal moves: ${normalMoves.length}`, normalMoves);
    console.log(`🎯 Jump moves: ${jumpMoves.length}`, jumpMoves);
    return { normalMoves, jumpMoves };
  };

  // handleCellClick - ボードセルクリック時の処理（コマ移動の準備）
  const handleCellClick = async (position: { x: number; y: number }) => {
    console.log('Board cell clicked:', position);
    console.log('Current game state:', gameState);
    console.log('Current turn player ID:', gameState?.current_turn);
    console.log('Current turn player info:', gameState?.players[gameState?.current_turn || '']);
    
    // ゲームが開始されていない場合は何もしない
    if (!gameState || !gameState.game_started) {
      addSystemMessage('ゲームが開始されていません');
      return;
    }
    
    // ゲームが終了している場合は何もしない
    if (gameState.winner) {
      addSystemMessage('ゲームは既に終了しています');
      return;
    }
    
    const currentPlayerId = getCurrentPlayerId();
    if (!currentPlayerId) {
      console.error('Current player ID not found');
      return;
    }
    
    // デモモードかマルチプレイヤーモードかを判定
    const isDemo = Object.keys(gameState.players).some(id => id.includes('_black'));
    const isMultiplayer = Object.keys(gameState.players).length === 2 && !isDemo;
    const currentTurnPlayerId = gameState.current_turn;
    
    console.log('Game mode:', { isDemo, isMultiplayer, currentTurnPlayerId, currentPlayerId });
    
    // ターン制の制御
    if (isMultiplayer && currentTurnPlayerId !== currentPlayerId) {
      addSystemMessage('あなたのターンではありません');
      return;
    }
    
    if (isDemo && !currentTurnPlayerId) {
      addSystemMessage('ゲーム状態が不正です');
      return;
    }
    
    // クリックしたセルにプレイヤーがいるかチェック
    const clickedPlayer = Object.values(gameState.players).find(
      player => player.position.x === position.x && player.position.y === position.y
    );
    
    // コマ選択の制御
    let canSelectPiece = false;
    if (isDemo) {
      // デモモード：現在のターンのプレイヤーのコマのみ選択可能
      canSelectPiece = clickedPlayer && clickedPlayer.id === currentTurnPlayerId;
    } else if (isMultiplayer) {
      // マルチプレイヤーモード：自分のコマかつ自分のターンの場合のみ選択可能
      canSelectPiece = clickedPlayer && clickedPlayer.id === currentPlayerId && currentTurnPlayerId === currentPlayerId;
    }
    
    if (canSelectPiece) {
      // コマを選択
      setSelectedPosition(position);
      const moveResults = calculateValidMoves(position);
      setValidMoves([...moveResults.normalMoves, ...moveResults.jumpMoves]); // 全ての移動可能位置
      setJumpMoves(moveResults.jumpMoves); // ジャンプ移動のみ
      const playerColor = clickedPlayer!.color;
      addSystemMessage(`${playerColor}のコマを選択しました（${String.fromCharCode(97 + position.x)}${9 - position.y}）`);
    } else if (selectedPosition && validMoves.some(move => move.x === position.x && move.y === position.y)) {
      // 移動可能なセルをクリックした場合 - 移動実行
      try {
        // ローカルでゲーム状態を更新
        const updatedGameState = { ...gameState };
        const movingPlayerId = currentTurnPlayerId; // 現在のターンのプレイヤーを移動
        
        if (updatedGameState.players[movingPlayerId]) {
          updatedGameState.players[movingPlayerId].position = position;
          
          // ターンを次のプレイヤーに切り替え
          const playerIds = Object.keys(updatedGameState.players);
          const currentIndex = playerIds.indexOf(updatedGameState.current_turn);
          const nextIndex = (currentIndex + 1) % playerIds.length;
          updatedGameState.current_turn = playerIds[nextIndex];
          
          // 勝利条件をチェック
          const winner = checkWinCondition(updatedGameState);
          if (winner) {
            updatedGameState.winner = winner;
            const winnerName = updatedGameState.players[winner]?.username || 'プレイヤー';
            const winnerColor = updatedGameState.players[winner]?.color || '';
            addSystemMessage(`🎉 ゲーム終了！ ${winnerName} (${winnerColor}) の勝利です！`);
            console.log('🏆 Game won by:', winnerName, winnerColor);
            
            // 勝利時に追加のメッセージを表示
            setTimeout(() => {
              addSystemMessage('ゲームを再開するには「ゲーム開始」ボタンを押してください');
            }, 1000);
          }
          
          // ローカル状態を更新
          setGameState(updatedGameState);
          setPlayers(Object.values(updatedGameState.players));
          
          // デモモードでない場合のみ他プレイヤーに通知
          if (!isDemo) {
            await nakamaService.sendMatchData(matchId, 3, {
              type: 'move',
              player_id: movingPlayerId,
              position: position
            });
          }
          
          const posStr = `${String.fromCharCode(97 + position.x)}${9 - position.y}`;
          const playerColor = updatedGameState.players[movingPlayerId].color;
          const nextPlayerColor = updatedGameState.players[updatedGameState.current_turn]?.color || '次のプレイヤー';
          addSystemMessage(`${playerColor}が${posStr}へ移動。${nextPlayerColor}のターンです。`);
        }
        
        // 選択状態をクリア
        setSelectedPosition(null);
        setValidMoves([]);
        setJumpMoves([]);
      } catch (error) {
        console.error('Failed to send move:', error);
        addSystemMessage('移動の送信に失敗しました');
      }
    } else {
      // その他のセルをクリックした場合 - 選択解除
      setSelectedPosition(null);
      setValidMoves([]);
      setJumpMoves([]);
    }
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
            {gameState && gameState.game_started && !gameState.winner ? (
              <>
                <h3>ゲーム状態</h3>
                <p>ゲーム開始: {gameState.game_started ? 'はい' : 'いいえ'}</p>
                <p>現在のターン: {gameState.players[gameState.current_turn]?.username || '待機中'} ({gameState.players[gameState.current_turn]?.color || ''})</p>
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
            ) : gameState && gameState.winner ? (
              <div style={{ textAlign: 'center' }}>
                <h3>🎉 ゲーム終了！</h3>
                <p style={{ fontSize: '18px', color: '#e74c3c', fontWeight: 'bold' }}>
                  {gameState.players[gameState.winner]?.username} ({gameState.players[gameState.winner]?.color}) の勝利！
                </p>
                <button 
                  onClick={() => {
                    setGameState(null);
                    setPlayers([]);
                    addSystemMessage('新しいゲームを開始してください');
                  }}
                  style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    marginTop: '10px'
                  }}
                >
                  新しいゲームを開始
                </button>
              </div>
            ) : (
              <div>
                <p>ゲーム待機中...</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button 
                    onClick={handleManualStartGame}
                    className="start-game-button"
                    style={{
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    🎮 ゲーム開始（デモモード）
                  </button>
                  <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                    デモモード：1人で白と黒の両方を操作できます
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Quoridorゲームボード - リアルタイム表示 */}
          <BoardComponent
            players={gameState?.players || {}}
            walls={gameState?.board?.walls || []}
            currentTurn={gameState?.current_turn || ''}
            onCellClick={handleCellClick}
            currentPlayerId={getCurrentPlayerId() || undefined}
            selectedPosition={selectedPosition}
            validMoves={validMoves}
            jumpMoves={jumpMoves}
          />
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