// Quoridor Chess ログインコンポーネント
// アプリ起動時のユーザー名入力と認証処理を管理
// シンプルなフォームUIでユーザー名を取得して認証を実行
import React, { useState } from 'react';
import './Login.css';

// LoginProps - ログインコンポーネントのプロパティ型定義
interface LoginProps {
  onLogin: (username: string, password: string) => void; // ログイン成功時のコールバック関数
  onRegister: (username: string, password: string) => void; // 新規登録時のコールバック関数
}

// Login メインコンポーネント - ユーザー名とパスワード入力フォーム
const Login: React.FC<LoginProps> = ({ onLogin, onRegister }) => {
  // 状態管理 - ユーザー入力とローディング状態
  const [username, setUsername] = useState('');        // ユーザー名入力フィールド
  const [password, setPassword] = useState('');        // パスワード入力フィールド
  const [isLoading, setIsLoading] = useState(false);   // ログイン処理中フラグ
  const [isRegisterMode, setIsRegisterMode] = useState(false); // 新規登録モードフラグ

  // handleSubmit - フォーム送信処理
  // ユーザー名とパスワードのバリデーションと認証処理を実行
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 入力バリデーション
    if (!username.trim()) {
      alert('ユーザー名を入力してください');
      return;
    }
    
    if (!password) {
      alert('パスワードを入力してください');
      return;
    }
    
    if (password.length < 6) {
      alert('パスワードは6文字以上で入力してください');
      return;
    }

    setIsLoading(true);  // ローディング状態を開始
    try {
      if (isRegisterMode) {
        await onRegister(username.trim(), password);  // 新規登録処理
      } else {
        await onLogin(username.trim(), password);  // ログイン処理
      }
    } catch (error) {
      // エラー処理は親コンポーネント（App.tsx）で行われる
    } finally {
      setIsLoading(false);  // 成功・失敗に関わらずローディングを終了
    }
  };

  // JSXレンダリング - ログイン/新規登録フォームUI
  return (
    <div className="login-container container">
      <h2>{isRegisterMode ? '新規登録' : 'ログイン'}</h2>
      
      {/* 認証フォーム */}
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
        
        <div className="form-group">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワードを入力（6文字以上）"
            disabled={isLoading}  // ローディング中は入力無効化
            minLength={6}         // 最小6文字
          />
        </div>
        
        {/* ログイン/登録ボタン */}
        <button type="submit" disabled={isLoading || !username.trim() || !password}>
          {isLoading ? '処理中...' : (isRegisterMode ? '登録' : 'ログイン')}
        </button>
      </form>
      
      {/* モード切り替えリンク */}
      <div className="mode-switch">
        {isRegisterMode ? (
          <>
            既にアカウントをお持ちの方は
            <button 
              type="button" 
              className="link-button"
              onClick={() => setIsRegisterMode(false)}
              disabled={isLoading}
            >
              ログイン
            </button>
          </>
        ) : (
          <>
            初めての方は
            <button 
              type="button" 
              className="link-button"
              onClick={() => setIsRegisterMode(true)}
              disabled={isLoading}
            >
              新規登録
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// Loginコンポーネントをデフォルトエクスポート
export default Login;