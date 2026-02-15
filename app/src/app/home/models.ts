interface Card {
  id: string;
  suit: string;
  value: string;
}

interface Player {
  isConnected: boolean;
  name: string;
  color: string;
  marblePositions: number[];
}

type PlayerColor = 'red' | 'green' | 'blue' | 'orange';

export interface GameState {
  players: Player[];
  isConnected: boolean;
  currentTurn: PlayerColor;
  hand: Card[];
  discardedCards: Card[];

}

export interface GameData {
  gameState: GameState;
  message: string;
  timestamp: number;
  type: string;
}