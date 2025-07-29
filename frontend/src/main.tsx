// Quoridor Chess Online - Reactアプリケーションのエントリーポイント
// Vite + React + TypeScriptで構築されたフロントエンドアプリの起動処理
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'           // メインアプリケーションコンポーネント
import './index.css'             // グローバルCSSスタイル

// React 18のConcurrent Renderingを使用してDOMにアプリをマウント
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />  {/* メインAppコンポーネントをレンダリング */}
  </React.StrictMode>,
)