// Quoridor Chess マッチメイキングルームコンポーネント
// プライベートマッチの作成と参加機能を提供
// ログイン後の対戦相手とのマッチングを管理
import { useState } from 'react';
import { nakamaService } from '../utils/nakama';
import './MatchmakingRoom.css';

// MatchmakingRoomProps - マッチメイキングルームコンポーネントのプロパティ型定義
interface MatchmakingRoomProps {
  username: string;    // ログイン中のユーザー名
  onMatchFound: (matchId: string, isCreator?: boolean) => void; // マッチ発見時のコールバック
}

// MatchmakingRoom メインコンポーネント - マッチ作成と参加UIを提供
const MatchmakingRoom: React.FC<MatchmakingRoomProps> = ({ username, onMatchFound }) => {
  // 状態管理 - UI表示とユーザー入力を管理
  const [status, setStatus] = useState('待機中');           // 現在のステータスメッセージ
  const [joinMatchId, setJoinMatchId] = useState('');       // 参加用マッチID入力フィールド



  // handleCreatePrivateMatch - プライベートマッチ作成処理
  // Nakamaサーバーに新しいマッチを作成し、IDをクリップボードにコピー
  const handleCreatePrivateMatch = async () => {
    try {
      const match = await nakamaService.createMatch();
      console.log('Raw match object:', match);
      console.log('Match ID before cleaning:', match.match_id);
      
      console.log('Match details:', {
        match_id: match.match_id,
        size: match.size,
        presences: match.presences
      });
      
      // マッチIDをクリップボードにコピー（他プレイヤーとの共有用）
      try {
        await navigator.clipboard.writeText(match.match_id);
        alert(`マッチを作成しました！\nマッチID: ${match.match_id}\n\nマッチIDがクリップボードにコピーされました。`);
      } catch (clipboardError) {
        // クリップボードAPIが使用できない場合のフォールバック
        alert(`マッチを作成しました！\nマッチID: ${match.match_id}\n\nこのIDを他のプレイヤーに共有してください。`);
      }
      
      // 作成者フラグをtrueにしてゲームルームに遷移
      onMatchFound(match.match_id, true);
    } catch (error) {
      console.error('Failed to create private match:', error);
      alert('プライベートマッチの作成に失敗しました');
    }
  };

  // handleJoinMatch - マッチ参加処理
  // 入力されたマッチIDのバリデーションとゲームルームへの遷移
  const handleJoinMatch = async () => {
    const matchId = joinMatchId.trim();
    if (!matchId) {
      alert('マッチIDを入力してください');
      return;
    }
    
    // UUID形式のバリデーション（NakamaのマッチID形式に合わせてチェック）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.?$/i;
    if (!uuidRegex.test(matchId)) {
      alert('マッチIDの形式が正しくありません');
      return;
    }
    
    console.log('Attempting to join match:', matchId);
    setStatus('マッチに参加しています...');  // UIステータス更新
    
    // 参加者フラグをfalseにしてゲームルームに遷移
    onMatchFound(matchId, false);
  };

  // JSXレンダリング - マッチメイキングUI
  return (
    <div className="matchmaking-container container">
      <h2>マッチメイキング</h2>
      <p className="welcome">ようこそ、{username}さん！</p>
      
      {/* ステータス表示エリア */}
      <div className="status-box">
        <p className="status">{status}</p>
      </div>

      {/* マッチ作成・参加ボタングループ */}
      <div className="button-group">
        {/* プライベートマッチ作成ボタン */}
        <button onClick={handleCreatePrivateMatch} className="primary-button">
          プライベートマッチ作成
        </button>
        
        {/* マッチ参加セクション - ID入力と参加ボタン */}
        <div className="join-match-section">
          <input
            type="text"
            placeholder="マッチIDを入力..."
            value={joinMatchId}
            onChange={(e) => setJoinMatchId(e.target.value)}
            className="match-id-input"
          />
          <button onClick={handleJoinMatch} className="secondary-button">
            マッチに参加
          </button>
        </div>
      </div>
    </div>
  );
};

// MatchmakingRoomコンポーネントをデフォルトエクスポート
export default MatchmakingRoom;