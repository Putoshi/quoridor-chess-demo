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

  // authenticate - ユーザー名とパスワードで認証を行う
  // セキュアな認証でユーザーアカウントを保護
  async authenticate(username: string, password: string): Promise<Session> {
    console.log('=== PASSWORD-BASED AUTHENTICATION ===');
    console.log('Authenticating user:', username);
    
    try {
      // カスタムIDで認証（ユーザー名+パスワードの組み合わせ）
      console.log('Attempting to authenticate with custom ID...');
      const customId = `${username}:${password}`;
      const session = await this.client.authenticateCustom(
        customId,
        false  // 新規作成なし
      );
      console.log('✅ Authentication successful');
      console.log('Session username:', session.username);
      console.log('Session user_id:', session.user_id);
      this.session = session;
      return session;
    } catch (error: any) {
      console.error('Authentication failed:', error);
      if (error.status === 404 || error.message?.includes('not found')) {
        throw new Error('ユーザーが見つかりません。新規登録してください');
      }
      throw new Error('ユーザー名またはパスワードが正しくありません');
    }
  }

  // register - 新規ユーザー登録
  // ユーザー名とパスワードで新しいアカウントを作成
  async register(username: string, password: string): Promise<Session> {
    console.log('=== NEW USER REGISTRATION ===');
    console.log('Registering new user:', username);
    
    try {
      // まず既存ユーザーをチェック
      const customId = `${username}:${password}`;
      try {
        await this.client.authenticateCustom(customId, false);
        // 既に存在する場合
        throw new Error('このユーザー名は既に使用されています');
      } catch (checkError: any) {
        // 404エラーの場合は新規作成可能
        if (checkError.status !== 404 && !checkError.message?.includes('not found')) {
          throw checkError;
        }
      }
      
      // 新規ユーザー作成
      const session = await this.client.authenticateCustom(
        customId,
        true  // 新規作成を許可
      );
      console.log('✅ Registration successful');
      console.log('Session username:', session.username);
      console.log('Session user_id:', session.user_id);
      
      // ユーザー名を更新
      if (session.username !== username) {
        try {
          await this.client.updateAccount(session, { username: username });
          session.username = username;
        } catch (updateError) {
          console.warn('Failed to update username:', updateError);
        }
      }
      
      this.session = session;
      return session;
    } catch (error: any) {
      console.error('Registration failed:', error);
      
      // エラーメッセージがある場合はそれを使用
      if (error.message) {
        throw error;
      }
      throw new Error('登録に失敗しました');
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

  // clearSession - 現在のセッションをクリア（ログアウト時に使用）
  clearSession(): void {
    this.session = null;
    if (this.socket) {
      this.socket.disconnect(true);
      this.socket = null;
    }
    console.log('Session cleared. User logged out.');
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