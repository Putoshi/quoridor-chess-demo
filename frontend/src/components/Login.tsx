// Quoridor Chess ログインコンポーネント
// アプリ起動時のユーザー名入力と認証処理を管理
// シンプルなフォームUIでユーザー名を取得して認証を実行
import React, { useState } from 'react';
import './Login.css';

// LoginProps - ログインコンポーネントのプロパティ型定義
interface LoginProps {
  onLogin: (username: string) => void; // ログイン成功時のコールバック関数
}

// Login メインコンポーネント - シンプルなユーザー名入力フォーム
const Login: React.FC<LoginProps> = ({ onLogin }) => {
  // 状態管理 - ユーザー入力とローディング状態
  const [username, setUsername] = useState('');        // ユーザー名入力フィールド
  const [isLoading, setIsLoading] = useState(false);   // ログイン処理中フラグ

  // handleSubmit - フォーム送信処理
  // ユーザー名のバリデーションとログイン処理を実行
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ユーザー名の空白チェック
    if (!username.trim()) {
      alert('ユーザー名を入力してください');
      return;
    }

    setIsLoading(true);  // ローディング状態を開始
    try {
      await onLogin(username.trim());  // 親コンポーネントのログイン処理を呼び出し
    } catch (error) {
      setIsLoading(false);  // エラー時はローディングを終了
    }
  };

  // JSXレンダリング - シンプルなログインフォームUI
  return (
    <div className="login-container container">
      <h2>ゲームに参加</h2>
      
      {/* ユーザー名入力フォーム */}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ユーザー名を入力"
            disabled={isLoading}  // ローディング中は入力無効化
            maxLength={20}        // 最大20文字まで
          />
        </div>
        
        {/* ログインボタン - ローディング中や空白入力時は無効化 */}
        <button type="submit" disabled={isLoading || !username.trim()}>
          {isLoading ? '接続中...' : 'ログイン'}
        </button>
      </form>
    </div>
  );
};

// Loginコンポーネントをデフォルトエクスポート
export default Login;