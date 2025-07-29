// Quoridor Chess オンライン対戦ゲーム - Nakama クライアントサービス
// WebSocket通信、認証、マッチメイキング、ゲーム通信を管理するシングルトンサービス
import { Client, Session, Socket, Match } from '@heroiclabs/nakama-js';

// NakamaService - Nakamaサーバーとの通信を管理するメインクラス
// シングルトンパターンで実装され、アプリ全体で一つのインスタンスを共有
class NakamaService {
  private client: Client;          // Nakamaクライアントインスタンス
  private session: Session | null = null;  // ユーザー認証セッション
  private socket: Socket | null = null;    // WebSocket接続

  constructor() {
    // Nakamaクライアントを初期化（APIキー、ホスト、ポート、SSL設定）
    this.client = new Client('defaultkey', 'localhost', '7350', false);
  }

  // authenticate - ユーザー名専用のデバイスIDベースで認証を行う
  // 各ユーザー名に対して固有のアカウントを作成・管理
  async authenticate(username: string): Promise<Session> {
    console.log('=== NEW AUTHENTICATION SYSTEM ===');
    console.log('Authenticating with username:', username);
    
    // ユーザー名専用のデバイスIDを生成
    const deviceId = this.generateDeviceId(username);
    console.log('Using device ID for user:', deviceId);
    
    try {
      // 既存アカウント確認のため、まず作成なしで認証を試行
      console.log('Checking for existing account...');
      const session = await this.client.authenticateDevice(deviceId, false);
      console.log('✅ EXISTING USER FOUND - NO CHANGES MADE');
      console.log('Session username:', session.username);
      console.log('Session user_id:', session.user_id);
      this.session = session;
      return session;
    } catch (error) {
      console.log('No existing user found, creating new account for:', username);
      
      // 新規ユーザー作成
      const session = await this.client.authenticateDevice(deviceId, true, username);
      console.log('✅ NEW USER CREATED');
      console.log('Session username:', session.username);
      console.log('Session user_id:', session.user_id);
      
      // 新規作成時のユーザー名設定確認
      if (session.username !== username) {
        console.log('Setting username for new account...');
        try {
          await this.client.updateAccount(session, { username: username });
          session.username = username;
          console.log('Username set successfully');
        } catch (updateError) {
          console.error('Failed to set username:', updateError);
        }
      }
      
      this.session = session;
      return session;
    }
  }

  // connectSocket - WebSocketリアルタイム通信接続を確立
  // マッチメイキング、ゲーム通信、チャットに使用
  async connectSocket(): Promise<Socket> {
    if (!this.session) {
      throw new Error('No session available');
    }

    const useSSL = false;   // SSL未使用（開発環境）
    const trace = false;    // デバッグトレース無効
    const socket = this.client.createSocket(useSSL, trace);
    await socket.connect(this.session, true);  // 自動再接続有効
    
    this.socket = socket;
    return socket;
  }

  // getSocket - 現在のWebSocket接続を取得
  getSocket(): Socket | null {
    return this.socket;
  }

  // getSession - 現在の認証セッションを取得
  getSession(): Session | null {
    return this.session;
  }

  // joinMatchmaking - マッチメイキングプールに参加
  // 他のプレイヤーとのマッチング待機状態に入る
  async joinMatchmaking(minPlayers: number = 2, maxPlayers: number = 2): Promise<string> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    // マッチメイキングプールに参加（"*"は任意のマッチタイプ）
    const result = await this.socket.addMatchmaker("*", minPlayers, maxPlayers);
    return result.ticket;  // マッチメイキングチケットを返却
  }

  // leaveMatchmaking - マッチメイキングプールから退出
  // 指定したチケットでマッチング待機をキャンセル
  async leaveMatchmaking(ticket: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    await this.socket.removeMatchmaker(ticket);
  }

  // createMatch - 新しいプライベートマッチを作成
  // マッチメイキングを使わずに直接マッチを作成
  async createMatch(): Promise<Match> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    const match = await this.socket.createMatch();
    return match;
  }

  // joinMatch - 指定されたマッチIDのマッチに参加
  // プライベートマッチやマッチメイキング結果のマッチに参加
  async joinMatch(matchId: string): Promise<Match> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    const match = await this.socket.joinMatch(matchId);
    return match;
  }

  // sendMatchData - マッチ内でリアルタイムデータを送信
  // ゲームの操作（駒移動、壁配置）やチャットメッセージの送信に使用
  async sendMatchData(matchId: string, opCode: number, data: any): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    // データをJSON文字列からバイト配列に変換
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(JSON.stringify(data));
    await this.socket.sendMatchState(matchId, opCode, dataBytes);
  }

  // sendChatMessage - チャットメッセージを送信（現在は未実装）
  // 実際のチャット機能はsendMatchDataを通じて実装される
  async sendChatMessage(message: string): Promise<void> {
    if (!this.session) {
      throw new Error('No session available');
    }

    // 注意: この実装は未完成。実際のチャットはsendMatchDataで実装
    await this.client.sendFriendRequest(this.session, this.session.user_id);
  }

  // generateDeviceId - ユーザー固有のデバイスIDを生成・管理
  // ユーザー名ベースでローカルストレージに保存して個別ユーザーの永続化を実現
  private generateDeviceId(username: string): string {
    const deviceKey = `device_id_${username}`;
    const storedId = localStorage.getItem(deviceKey);
    if (storedId) {
      return storedId;  // 既存のユーザー固有デバイスIDを使用
    }

    // 新しいランダムなデバイスIDを生成（ユーザー名プレフィックス付き）
    const newId = `device_${username}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(deviceKey, newId);
    return newId;
  }

  // clearDeviceId - 指定ユーザーのデバイスIDをリセットして新しいユーザーとして認証
  // デバッグ用途で別のユーザーアカウントを作成したい場合に使用
  clearDeviceId(username?: string): void {
    if (username) {
      const deviceKey = `device_id_${username}`;
      localStorage.removeItem(deviceKey);
      console.log(`Device ID cleared for user: ${username}. Next login will create a new user.`);
    } else {
      // 全てのデバイスIDをクリア（後方互換性）
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('device_id')) {
          localStorage.removeItem(key);
        }
      });
      console.log('All device IDs cleared. Next login will create new users.');
    }
  }

  // disconnect - WebSocket接続を切断してリソースをクリーンアップ
  // アプリ終了時やログアウト時に呼び出し
  disconnect() {
    if (this.socket) {
      this.socket.disconnect(true);  // 強制切断
      this.socket = null;
    }
  }
}

// nakamaService - シングルトンインスタンスをエクスポート
// アプリ全体でこの一つのインスタンスを共有して使用
export const nakamaService = new NakamaService();