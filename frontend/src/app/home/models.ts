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

export interface Action {
  type: ActionType;
  from: number;
  to: number;
}

export interface CurrentTurn {
  color: PlayerColor;
  lastAction: Action;
  lastCardPlayed: Card;
}

export type PlayerColor = 'red' | 'green' | 'blue' | 'orange';
type ActionType = 
  | 'move'      // déplacement simple
  | 'capture'   // prise d'un pion adverse
  | 'swap'      // échange
  | 'promote'   // promotion
  | 'enter';    // entrée en jeu
export interface GameState {
  players: Player[];
  isConnected: boolean;
  currentTurn: CurrentTurn;
  timer: number;
  hand: Card[];
  discardedCards: Card[];

}

export interface GameData {
  gameState: GameState;
  message: string;
  timestamp: number;
  type: string;
}