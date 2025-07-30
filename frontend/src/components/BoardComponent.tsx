// Quoridor Chess ゲームボードコンポーネント
// 9x9グリッドのボード、プレイヤーコマ、壁の表示と基本的なクリックイベントを管理
import React from 'react';
import './BoardComponent.css';

// Position - ボード上の位置を表す型
interface Position {
  x: number; // X座標（0-8）
  y: number; // Y座標（0-8）
}

// Wall - 壁の情報を表す型（Goサーバーと同じ構造）
interface Wall {
  position: Position; // 壁の基準位置
  is_horizontal: boolean; // 水平壁かどうか（falseの場合は垂直壁）
}

// Player - プレイヤー情報の型（GameRoom.tsxから継承）
interface Player {
  id: string;
  username: string;
  position: Position;
  walls: number;
  color: string; // "white" または "black"
}

// BoardComponentProps - ボードコンポーネントのプロパティ
interface BoardComponentProps {
  players: { [key: string]: Player }; // プレイヤー情報のマップ
  walls: Wall[]; // 配置済み壁のリスト
  currentTurn: string; // 現在のターンのプレイヤーID
  onCellClick?: (position: Position) => void; // セルクリック時のコールバック
  currentPlayerId?: string; // 現在のプレイヤーID
  selectedPosition?: Position | null; // 選択中のセル位置
  validMoves?: Position[]; // 移動可能な位置のリスト
  jumpMoves?: Position[]; // ジャンプ移動の位置のリスト
}

// BoardComponent - メインコンポーネント
const BoardComponent: React.FC<BoardComponentProps> = ({
  players,
  walls,
  currentTurn,
  onCellClick,
  currentPlayerId,
  selectedPosition,
  validMoves = [],
  jumpMoves = []
}) => {
  
  // getPlayerAtPosition - 指定位置にいるプレイヤーを取得
  const getPlayerAtPosition = (position: Position): Player | null => {
    return Object.values(players).find(player => 
      player.position.x === position.x && player.position.y === position.y
    ) || null;
  };

  // isWallAtPosition - 指定位置に壁があるかチェック（将来実装）
  // const isWallAtPosition = (position: Position, isHorizontal: boolean): boolean => {
  //   return walls.some(wall => 
  //     wall.position.x === position.x && 
  //     wall.position.y === position.y && 
  //     wall.is_horizontal === isHorizontal
  //   );
  // };

  // isValidMove - 指定位置が移動可能かチェック
  const isValidMove = (position: Position): boolean => {
    return validMoves.some(move => move.x === position.x && move.y === position.y);
  };

  // isJumpMove - 指定位置がジャンプ移動かチェック
  const isJumpMove = (position: Position): boolean => {
    return jumpMoves.some(move => move.x === position.x && move.y === position.y);
  };

  // isCurrentPlayerPiece - 指定位置が現在のターンのプレイヤーのコマかチェック
  const isCurrentPlayerPiece = (position: Position): boolean => {
    const player = getPlayerAtPosition(position);
    return player !== null && player.id === currentTurn;
  };

  // isSelectedPosition - 指定位置が選択中かチェック
  const isSelectedPosition = (position: Position): boolean => {
    return selectedPosition !== null &&
           selectedPosition !== undefined &&
           selectedPosition.x === position.x &&
           selectedPosition.y === position.y;
  };

  // handleCellClick - セルクリック時の処理
  const handleCellClick = (position: Position) => {
    console.log('Cell clicked:', position);
    if (onCellClick) {
      onCellClick(position);
    }
  };

  // ボードのレンダリング
  const renderBoard = () => {
    const cells = [];
    
    // 9x9のグリッドを生成（Quoridor標準サイズ）
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const position = { x, y };
        const player = getPlayerAtPosition(position);
        
        // セルのCSSクラスを決定
        const cellClasses = ['board-cell'];
        
        // 開始位置のハイライト（Quoridor標準：白=e9, 黒=e1）
        if (y === 0 && x === 4) cellClasses.push('start-position-black'); // 黒の開始位置（e1）
        if (y === 8 && x === 4) cellClasses.push('start-position-white'); // 白の開始位置（e9）
        
        // ゴールラインのハイライト
        if (y === 0) cellClasses.push('goal-line-black'); // 黒のゴールライン（相手側）
        if (y === 8) cellClasses.push('goal-line-white'); // 白のゴールライン（相手側）
        
        // インタラクティブハイライト
        if (isSelectedPosition(position)) cellClasses.push('selected'); // 選択中のセル
        if (isValidMove(position)) {
          if (isJumpMove(position)) {
            cellClasses.push('jump-move'); // ジャンプ移動
          } else {
            cellClasses.push('valid-move'); // 通常の移動
          }
        }
        
        // プレイヤーコマの状態によるスタイリング
        if (player) {
          if (isCurrentPlayerPiece(position)) {
            cellClasses.push('clickable-piece'); // 現在のターンのコマ
          } else {
            cellClasses.push('non-active-piece'); // ターンではないコマ
          }
        }
        
        cells.push(
          <div
            key={`cell-${x}-${y}`}
            className={cellClasses.join(' ')}
            onClick={() => handleCellClick(position)}
            data-position={`${x},${y}`}
          >
            {/* プレイヤーコマの表示 */}
            {player && (
              <div className={`player-piece ${player.color}`}>
                <span className="player-initial">
                  {player.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            
            {/* 座標表示（デバッグ用） */}
            <div className="cell-coordinates">
              {String.fromCharCode(97 + x)}{9 - y}
            </div>
          </div>
        );
      }
    }
    
    return cells;
  };

  return (
    <div className="board-container">
      {/* ボードヘッダー - ゲーム情報表示 */}
      <div className="board-header">
        <h3>Quoridor Chess ボード</h3>
        <div className="board-info">
          <span className="current-turn">
            現在のターン: {players[currentTurn]?.username || '待機中'} ({players[currentTurn]?.color || ''})
          </span>
        </div>
      </div>
      
      {/* メインボード - 9x9グリッド */}
      <div className="game-board">
        {renderBoard()}
      </div>
      
      {/* ボード下部 - 操作説明 */}
      <div className="board-footer">
        <div className="board-instructions">
          <p>• セルをクリックしてコマを移動（将来実装）</p>
          <p>• 壁の配置機能（将来実装）</p>
        </div>
      </div>
      
      {/* 壁情報表示（デバッグ用） */}
      {walls.length > 0 && (
        <div className="walls-debug">
          <h4>配置済み壁 ({walls.length}個)</h4>
          {walls.map((wall, index) => (
            <div key={index} className="wall-info">
              {String.fromCharCode(97 + wall.position.x)}{9 - wall.position.y}
              ({wall.is_horizontal ? '水平' : '垂直'})
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BoardComponent;