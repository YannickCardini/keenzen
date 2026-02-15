interface Card {
  id: string;
  suit: string;
  value: string;
}

export interface Player {
  isConnected: boolean;
  name: string;
  color: string;
  marblePositions: number[];
}

export type PlayerColor = 'red' | 'green' | 'blue' | 'orange';

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