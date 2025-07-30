// Quoridor Chess Online - メインアプリケーションコンポーネント
// アプリ全体の状態管理とルーティングを担当
// ログイン → マッチメイキング → ゲームルームの流れを制御
import React, { useState, useEffect } from 'react';
import { nakamaService } from './utils/nakama';
import MatchmakingRoom from './components/MatchmakingRoom';
import GameRoom from './components/GameRoom';
import Login from './components/Login';
import './App.css';

// AppState - アプリケーションの現在の画面状態を定義
type AppState = 'login' | 'matchmaking' | 'game';

// GameState - ゲーム状態の管理用インターフェース
interface GameState {
  matchId: string;    // 参加中のマッチの一意識別子
  players: any[];     // マッチ内のプレイヤー一覧（現在未使用）
  isCreator: boolean; // マッチ作成者かどうかのフラグ
}

// App メインコンポーネント - アプリケーション全体の状態とルーティングを管理
function App() {
  // 状態管理 - アプリの画面遷移とユーザー情報
  const [appState, setAppState] = useState<AppState>('login');    // 現在の画面状態
  const [username, setUsername] = useState<string>('');           // ログイン中のユーザー名
  const [gameState, setGameState] = useState<GameState | null>(null); // ゲーム状態

  // クリーンアップエフェクト - アプリ終了時にWebSocket接続を切断
  useEffect(() => {
    return () => {
      nakamaService.disconnect();
    };
  }, []);

  // handleLogin - ユーザーログイン処理
  // 認証とWebSocket接続を行い、成功時はマッチメイキング画面に遷移
  const handleLogin = async (name: string, password: string) => {
    try {
      console.log('App.tsx: Attempting login with name:', name);
      await nakamaService.authenticate(name, password);    // パスワード認証
      await nakamaService.connectSocket();                  // WebSocket接続確立
      console.log('App.tsx: Setting username to:', name);
      setUsername(name);
      setAppState('matchmaking');                          // マッチメイキング画面に遷移
    } catch (error: any) {
      console.error('Login failed:', error);
      alert(error.message || 'ログインに失敗しました');
    }
  };

  // handleRegister - 新規ユーザー登録処理
  // 新規アカウントを作成し、成功時は自動的にログイン
  const handleRegister = async (name: string, password: string) => {
    try {
      console.log('App.tsx: Attempting registration with name:', name);
      await nakamaService.register(name, password);        // 新規登録
      await nakamaService.connectSocket();                  // WebSocket接続確立
      console.log('App.tsx: Registration successful, setting username to:', name);
      setUsername(name);
      setAppState('matchmaking');                          // マッチメイキング画面に遷移
    } catch (error: any) {
      console.error('Registration failed:', error);
      alert(error.message || '登録に失敗しました');
    }
  };

  // handleMatchFound - マッチ発見時の処理
  // マッチメイキング成功またはプライベートマッチ作成時に呼び出される
  const handleMatchFound = (matchId: string, isCreator: boolean = false) => {
    setGameState({ matchId, players: [], isCreator });
    setAppState('game');  // ゲームルーム画面に遷移
  };

  // handleLeaveGame - ゲーム退出時の処理
  // ゲームルームからマッチメイキング画面に戻る
  const handleLeaveGame = () => {
    setGameState(null);            // ゲーム状態をクリア
    setAppState('matchmaking');    // マッチメイキング画面に戻る
  };

  // JSXレンダリング - 条件分岐による画面表示制御
  return (
    <div className="app">
      <h1>Quoridor Chess Online</h1>
      
      {/* ログイン画面 - アプリ起動時の初期画面 */}
      {appState === 'login' && (
        <Login onLogin={handleLogin} onRegister={handleRegister} />
      )}
      
      {/* マッチメイキング画面 - ログイン後の対戦相手検索・マッチ作成 */}
      {appState === 'matchmaking' && (
        <MatchmakingRoom 
          username={username}
          onMatchFound={handleMatchFound}
        />
      )}
      
      {/* ゲームルーム画面 - 実際のゲームプレイとチャット */}
      {appState === 'game' && gameState && (
        <GameRoom 
          matchId={gameState.matchId}
          username={username}
          isCreator={gameState.isCreator}
          onLeave={handleLeaveGame}
        />
      )}
    </div>
  );
}

// Appコンポーネントをデフォルトエクスポート
export default App;