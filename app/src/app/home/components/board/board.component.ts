import { Component, HostListener, OnInit } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { Player, PlayerColor } from '../../models';
import { IonCol, IonGrid, IonRow } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { getSquareToDisplay as getSquare } from './square-data';
@Component({
  selector: 'app-board',
  templateUrl: 'board.component.html',
  styleUrls: ['board.component.scss'],
  imports: [IonCol, IonRow, IonGrid, CommonModule]
})
export class BoardComponent implements OnInit {
  gridSize = 15;
  squareSize: number = 0;
  squareToDisplay: number[] = [];

  // Définition des cases spéciales
  homes = {
    red: [3, 18, 33, 48],
    green: [13, 28, 43, 58],
    blue: [168, 183, 198, 213],
    orange: [178, 193, 208, 223]
  };

  arrivals = {
    red: [38, 53, 68, 83],
    green: [115, 116, 117, 118],
    blue: [143, 158, 173, 188],
    orange: [108, 109, 110, 111]
  };

  starts = {
    red: 9,
    green: 135,
    blue: 217,
    orange: 91
  };

  // Indices de départ pour les cartes joueurs
  playerInfoStarts: { [key: number]: PlayerColor } = {
    61: 'red',
    71: 'green',
    151: 'blue',
    161: 'orange'
  };

  // Cases absorbées par les cartes joueurs (à ne pas rendre pour garder la grille alignée)
  skippedIndices = [
    62, 63, 64, 65,
    72, 73, 74, 75,
    152, 153, 154, 155,
    162, 163, 164, 165
  ];

  constructor(private gameStateService: GameStateService) { }

  ngOnInit() {
    this.calculateSquareSize();
    this.loadSquareData();
  }

  loadSquareData() {
    // Ton chemin de base + cases spéciales incluses
    this.squareToDisplay = getSquare(this.gridSize);
  }

  @HostListener('window:resize')
  onResize() {
    this.calculateSquareSize();
  }

  calculateSquareSize() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - 56; // Compensation header Ionic
    const sizeBasedOnWidth = viewportWidth / this.gridSize;
    const sizeBasedOnHeight = viewportHeight / this.gridSize;
    this.squareSize = Math.min(sizeBasedOnWidth, sizeBasedOnHeight);
  }

  get rows(): number[] { return Array(this.gridSize).fill(0).map((_, i) => i); }
  get cols(): number[] { return Array(this.gridSize).fill(0).map((_, i) => i); }

  getSquareIndex(row: number, col: number): number {
    return row * this.gridSize + col + 1;
  }

  shouldSkip(index: number): boolean {
    return this.skippedIndices.includes(index);
  }

  getSquareClass(index: number): string {
    if (!this.squareToDisplay.includes(index)) return 'case-hidden';

    // Détection Départ
    for (const [color, pos] of Object.entries(this.starts)) {
      if (pos === index) return `case-path start start-${color}`;
    }
    // Détection Maison
    for (const [color, positions] of Object.entries(this.homes)) {
      if (positions.includes(index)) return `case-path home home-${color}`;
    }
    // Détection Arrivée
    for (const [color, positions] of Object.entries(this.arrivals)) {
      if (positions.includes(index)) return `case-path arrival arrival-${color}`;
    }
    return 'case-path normal';
  }

  // Récupère les infos du joueur pour un encart spécifique
  getPlayer(color: PlayerColor): Player | undefined {
    const gameData = this.gameStateService.data();
    if (!gameData) return undefined;
    return gameData.gameState.players.find(p => p.color === color);
  }

  // Vérifie le tour actuel
  isCurrentTurn(color: PlayerColor): boolean {
    const gameData = this.gameStateService.data();
    return gameData?.gameState.currentTurn === color;
  }

  // Récupère la couleur du pion sur une case (s'il y en a un)
  getMarbleOnSquare(index: number): PlayerColor | null {
    const gameData = this.gameStateService.data();
    if (!gameData || !this.gameStateService.isConnected()) return null;

    const player = gameData.gameState.players.find(p => (p.marblePositions || []).includes(index));
    return player ? (player.color as PlayerColor) : null;
  }
}