import { Component, HostListener, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { IonCol, IonGrid, IonRow } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { TockCardComponent } from 'src/app/shared/tock-card.component';
import { Subscription } from 'rxjs';

import {
  MarbleColor,
  ActionType,
  Action,
  Player,
  GRID_SIZE,
  SQUARES_TO_DISPLAY,
  HOME_POSITIONS,
  START_POSITIONS,
  ARRIVAL_POSITIONS,
  PLAYER_INFO_STARTS,
  SKIPPED_INDICES,
  MARBLE_ANIMATION_DURATIONS,
  CARD_LAND_DELAY_MS,
  CARD_FLY_DURATION_MS,
} from '@keezen/shared';

export interface CardInfo {
  value: string;
  suit: string;
  color: MarbleColor;
}

export interface SquareAnimation {
  marbleClass: string;
  squareClass?: string;
}

@Component({
  selector: 'app-board',
  templateUrl: 'board.component.html',
  styleUrls: ['board.component.scss'],
  imports: [IonCol, IonRow, IonGrid, CommonModule, TockCardComponent]
})
export class BoardComponent implements OnInit, OnDestroy {

  // ── Config plateau ──────────────────────────────────────────────────────────
  readonly gridSize = GRID_SIZE;
  readonly homes = HOME_POSITIONS;
  readonly arrivals = ARRIVAL_POSITIONS;
  readonly starts = START_POSITIONS;
  readonly playerInfoStarts = PLAYER_INFO_STARTS;
  readonly skippedIndices = SKIPPED_INDICES;

  // ── État UI ─────────────────────────────────────────────────────────────────
  squareSize: number = 0;
  squareToDisplay: number[] = SQUARES_TO_DISPLAY;
  squareAnimations = signal<Record<number, SquareAnimation>>({});
  discardPile = signal<CardInfo[]>([]);
  flyingCard = signal<CardInfo | null>(null);
  debug = true;

  // ── Timers internes ─────────────────────────────────────────────────────────
  private animationTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
  private flyingCardTimeout: ReturnType<typeof setTimeout> | null = null;

  // ── Bug 3 fix : pipeline d'animation en deux phases ─────────────────────────
  //
  // PROBLÈME : quand `actionPlayed` arrive, le DOM reflète encore l'ANCIEN état
  // (le pion est sur sa case de départ). Le `gameState` mis à jour n'arrive
  // qu'ensuite. Si on anime immédiatement la case cible, le pion n'y est pas
  // encore → l'animation ne se voit pas.
  //
  // SOLUTION : on découpe en deux phases :
  //   Phase 1 (sur actionPlayed) → animation de carte uniquement
  //   Phase 2 (sur gameState)    → animation du pion (il est maintenant au bon endroit)
  //                              → puis sendAnimationDone
  //
  // `pendingMarbleAnimation` stocke l'action entre les deux phases.
  private pendingMarbleAnimation: Action | null = null;
  private actionPlayedSub: Subscription | null = null;

  constructor(private gameStateService: GameStateService) {

    // ── Phase 1 : actionPlayed → animation de carte ──────────────────────────
    this.actionPlayedSub = this.gameStateService.actionPlayed$.subscribe((action: Action) => {
      this.pendingMarbleAnimation = action; // on mémorise pour la phase 2

      if (action.cardPlayed) {
        const card: CardInfo = {
          value: action.cardPlayed.value,
          suit: action.cardPlayed.suit,
          color: action.playerColor as MarbleColor,
        };
        // Lance l'animation de vol de carte uniquement.
        // La carte va "voler" pendant que le gameState est en route.
        this.triggerCardAnimation(card);
      }
      // Pas de sendAnimationDone ici — on attend la phase 2.
    });

    // ── Phase 2 : gameState → pion au bon endroit → animation du pion ────────
    effect(() => {
      const gameData = this.gameStateService.data();
      if (!gameData) return;

      const action = this.pendingMarbleAnimation;
      if (!action) return;

      // Consomme l'action en attente pour ne pas la rejouer
      this.pendingMarbleAnimation = null;

      // Le DOM va se mettre à jour avec les nouvelles positions via data().
      // On attend un frame pour laisser Angular re-rendre les pions avant d'animer.
      requestAnimationFrame(() => {
        this.triggerMarbleAnimation(action, () => {
          this.gameStateService.sendAnimationDone();
        });
      });
    });
  }

  // ── Animations ──────────────────────────────────────────────────────────────

  private triggerMarbleAnimation(
    action: { type: string; from: number; to: number },
    onComplete: () => void
  ): void {
    const type = action.type as ActionType;
    const duration = MARBLE_ANIMATION_DURATIONS[type] ?? 0;

    if (duration === 0) {
      onComplete();
      return;
    }

    switch (type) {
      case 'enter':
        this.triggerAnimation(action.to, { marbleClass: 'marble-entering' }, duration, onComplete);
        break;

      case 'move':
        this.triggerAnimation(action.to, { marbleClass: 'marble-moving' }, duration, onComplete);
        break;

      case 'capture':
        this.triggerAnimationParallel([
          { index: action.to, anim: { marbleClass: 'marble-capturing', squareClass: 'square-impact' } },
          { index: action.from, anim: { marbleClass: 'marble-captured-exit' } },
        ], duration, onComplete);
        break;

      case 'swap':
        this.triggerAnimationParallel([
          { index: action.from, anim: { marbleClass: 'marble-swapping' } },
          { index: action.to, anim: { marbleClass: 'marble-swapping' } },
        ], duration, onComplete);
        break;

      case 'promote':
        this.triggerAnimation(action.to, {
          marbleClass: 'marble-promoting',
          squareClass: 'square-promoting',
        }, duration, onComplete);
        break;

      default:
        onComplete();
    }
  }

  private triggerAnimation(
    index: number,
    anim: SquareAnimation,
    duration: number,
    onComplete?: () => void
  ): void {
    const existing = this.animationTimeouts.get(index);
    if (existing) clearTimeout(existing);

    // Supprime la classe d'abord pour forcer le re-trigger CSS
    this.squareAnimations.update(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    requestAnimationFrame(() => {
      this.squareAnimations.update(prev => ({ ...prev, [index]: anim }));

      const timeout = setTimeout(() => {
        this.squareAnimations.update(prev => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
        this.animationTimeouts.delete(index);
        onComplete?.();
      }, duration);

      this.animationTimeouts.set(index, timeout);
    });
  }

  private triggerAnimationParallel(
    targets: Array<{ index: number; anim: SquareAnimation }>,
    duration: number,
    onComplete: () => void
  ): void {
    let remaining = targets.length;
    const onEachDone = () => {
      remaining--;
      if (remaining === 0) onComplete();
    };
    for (const { index, anim } of targets) {
      this.triggerAnimation(index, anim, duration, onEachDone);
    }
  }

  /**
   * Lance l'animation de vol de carte vers la pile de défausse.
   * Pas de callback ici : elle est indépendante du pipeline marble/animationDone.
   */
  private triggerCardAnimation(card: CardInfo): void {
    if (this.flyingCardTimeout) clearTimeout(this.flyingCardTimeout);

    this.flyingCard.set(null);
    requestAnimationFrame(() => {
      this.flyingCard.set(card);
      this.flyingCardTimeout = setTimeout(() => {
        this.discardPile.update(pile => [card, ...pile]);
        this.flyingCard.set(null);
        this.flyingCardTimeout = null;
      }, CARD_LAND_DELAY_MS);
    });
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  get topDiscardCard(): CardInfo | null {
    return this.discardPile()[0] ?? null;
  }

  getMarbleAnimClass(index: number): string {
    return this.squareAnimations()[index]?.marbleClass ?? '';
  }

  getSquareAnimClass(index: number): string {
    return this.squareAnimations()[index]?.squareClass ?? '';
  }

  get rows(): number[] { return Array(this.gridSize).fill(0).map((_, i) => i); }
  get cols(): number[] { return Array(this.gridSize).fill(0).map((_, i) => i); }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit() {
    this.calculateSquareSize();
    this.injectAnimationDurations();
  }

  ngOnDestroy(): void {
    this.actionPlayedSub?.unsubscribe();
    this.animationTimeouts.forEach(t => clearTimeout(t));
    if (this.flyingCardTimeout) clearTimeout(this.flyingCardTimeout);
  }

  private injectAnimationDurations(): void {
    const root = document.documentElement;
    root.style.setProperty('--anim-enter', `${MARBLE_ANIMATION_DURATIONS.enter}ms`);
    root.style.setProperty('--anim-move', `${MARBLE_ANIMATION_DURATIONS.move}ms`);
    root.style.setProperty('--anim-capture', `${MARBLE_ANIMATION_DURATIONS.capture}ms`);
    root.style.setProperty('--anim-swap', `${MARBLE_ANIMATION_DURATIONS.swap}ms`);
    root.style.setProperty('--anim-promote', `${MARBLE_ANIMATION_DURATIONS.promote}ms`);
    root.style.setProperty('--anim-card-fly', `${CARD_FLY_DURATION_MS}ms`);
  }

  @HostListener('window:resize')
  onResize() {
    this.calculateSquareSize();
  }

  calculateSquareSize() {
    const wrapper = document.querySelector('.board-wrapper');
    if (!wrapper) return;

    const bounds = wrapper.getBoundingClientRect();
    const containerSize = Math.min(bounds.width, bounds.height) * 0.95;
    this.squareSize = containerSize / this.gridSize;
    this.gameStateService.boardContainerSize.set(this.calculateTableWrapperSize(containerSize));
  }

  private calculateTableWrapperSize(containerSize: number): number {
    const borderSize = 2;
    const padding = 0.2;
    return (containerSize + borderSize) + (((containerSize + borderSize) / this.gridSize) * padding) * 2;
  }

  // ── Template helpers ────────────────────────────────────────────────────────

  getSquareIndex(row: number, col: number): number {
    return row * this.gridSize + col + 1;
  }

  shouldSkip(index: number): boolean {
    return this.skippedIndices.includes(index);
  }

  getSquareClass(index: number): string {
    if (!this.squareToDisplay.includes(index)) return 'case-hidden';

    for (const [color, pos] of Object.entries(this.starts)) {
      if (pos === index) return `case-path start start-${color}`;
    }
    for (const [color, positions] of Object.entries(this.homes)) {
      if ((positions as number[]).includes(index)) return `case-path home home-${color}`;
    }
    for (const [color, positions] of Object.entries(this.arrivals)) {
      if ((positions as number[]).includes(index)) return `case-path arrival arrival-${color}`;
    }
    return 'case-path normal';
  }

  getPlayer(color: MarbleColor): Player | undefined {
    return this.gameStateService.data()?.gameState.players.find(p => p.color === color);
  }

  isCurrentTurn(color: MarbleColor): boolean {
    return this.gameStateService.data()?.gameState.currentTurn.color === color;
  }

  getMarbleOnSquare(index: number): MarbleColor | null {
    const gameData = this.gameStateService.data();
    if (!gameData || !this.gameStateService.isConnected()) return null;

    const player = gameData.gameState.players.find(p =>
      (p.marblePositions ?? []).includes(index)
    );
    return player ? player.color as MarbleColor : null;
  }
}