import { GameStateService } from './../../services/game-state.service';
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';

interface Card {
  id: string;
  suit: string;
  value: string;
}

@Component({
  selector: 'app-table',
  templateUrl: 'table.component.html',
  styleUrl: 'table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: []
})
export class TableComponent {

  constructor(private gameStateService: GameStateService) { }

  // Expose the hand from GameStateService for template iteration
  // This uses the computed signal which automatically updates when data changes
  get hand(): Card[] {
    return this.gameStateService.hand();
  }

  selectedCardIndex = signal<number | null>(null);
  turnPhase = signal<string>('Select a card');
  currentPlayerColor = signal<string>('#ef4444');
  currentPlayerName = signal<string>('Red');

  onCardSelected(index: number) {
    if (this.selectedCardIndex() === index) {
      this.selectedCardIndex.set(null);
      this.turnPhase.set('Select a card');
    } else {
      this.selectedCardIndex.set(index);
      this.turnPhase.set('Select a marble');
    }
  }

  selectCard(index: number) {
    this.onCardSelected(index);
  }

  getPlayerHand(): Card[] {
    const gameData = this.gameStateService.data();
    if (!gameData) return [];
    return gameData.gameState.hand;
  }
}