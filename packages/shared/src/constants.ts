// ─────────────────────────────────────────────────────────────────────────────
// packages/shared/src/constants.ts
//
// Constantes partagées entre le front et le back.
//
// ANIMATIONS : les durées ici sont la source de vérité.
// Le SCSS doit les refléter via des CSS custom properties.
// Voir : apps/frontend/src/styles/_animations.scss
//
// Convention : toutes les durées sont en millisecondes (ms).
// ─────────────────────────────────────────────────────────────────────────────

import { MAIN_PATH } from './board-config.js';
import { isOnMainPath } from './move-validator.js';
import type { Action, ActionType } from './types.js';

// ── Durée du tour ─────────────────────────────────────────────────────────────

/** Durée d'un tour de jeu en secondes. */
export const TURN_DURATION_SECONDS = 30;

/** Durée d'un tour de jeu en millisecondes. */
export const TURN_DURATION_MS = TURN_DURATION_SECONDS * 1000;

/**
 * Délai de sécurité ajouté côté backend après TURN_DURATION_MS.
 * Le frontend envoie `turnTimeout` à la fin de son timer.
 * Si le message n'arrive pas (déconnexion, crash), le backend joue
 * le coup fallback après TURN_DURATION_MS + TURN_TIMEOUT_OFFSET_MS.
 */
export const TURN_TIMEOUT_OFFSET_MS = 5000;

// ── Durées d'animation des pions (ms) ────────────────────────────────────────

export const MARBLE_ANIMATION_DURATIONS: Record<ActionType, number> = {
  enter: 800,
  move: 200,
  capture: 800,
  swap: 1200,
  promote: 1000,
  discard: 1000,
  pass: 0,   // pas d'animation pour un pass
};

// ── Durée de l'animation de vol de carte (ms) ─────────────────────────────────
//
// Doit correspondre à la durée de l'animation CSS `.flying-card`.
// La carte reste visible CARD_FLY_DURATION ms avant d'atterrir sur la pile.

export const CARD_FLY_DURATION_MS = 1500;

/** Délai avant de déclencher les animations de pions après le vol de carte. */
export const CARD_LAND_DELAY_MS = 1600;

// ── Affichage ─────────────────────────────────────────────────────────────────

/** Durée d'affichage du bandeau "Nouveau tour" en millisecondes. */
export const NEW_TURN_BANNER_DURATION_MS = 2500;

/** Nombre de cartes maximum visibles dans la pile de défausse. */
export const MAX_VISIBLE_DISCARD_CARDS = 5;

// ── Jeu de cartes ─────────────────────────────────────────────────────────────

/** Nombre de cartes distribuées à chaque joueur en début de tour. */
export const CARDS_PER_HAND = 5;

/** Cartes qui permettent d'entrer un pion en jeu. */
export const ENTER_CARDS: string[] = ['A', 'K'];

// ── Durées d'animation enter+capture (ms) ────────────────────────────────────

/** Durée de l'animation d'impact du pion entrant sur la case (squash/rebound). */
export const ENTER_IMPACT_DURATION_MS = 500;

/** Durée de l'animation d'éjection du pion ennemi lors d'un enter+capture. */
export const MARBLE_EJECTED_DURATION_MS = 400;

/** Délai entre chaque carte lors d'un discard (vol en cascade).
 *  Doit correspondre à STAGGER_MS dans board.component.ts > flyDiscardCards. */
export const DISCARD_CARD_STAGGER_MS = 220;

// ── Calcul de la durée minimale d'animation ──────────────────────────────────
//
// Le serveur s'en sert pour faire autorité sur le rythme entre deux coups :
// il attend AU MOINS ce délai après avoir broadcast `actionPlayed` avant de
// passer au tour suivant. Empêche un client malveillant de spammer
// `animationDone` instantanément pour couper les animations des autres.

export function computeMinAnimationDuration(action: Action): number {
  if (action.type === 'pass') return 0;

  let cardDuration = 0;
  if (action.cardPlayed?.length) {
    if (action.type === 'discard') {
      cardDuration = (action.cardPlayed.length - 1) * DISCARD_CARD_STAGGER_MS + CARD_FLY_DURATION_MS;
    } else {
      cardDuration = CARD_LAND_DELAY_MS;
    }
  }

  let marbleDuration = MARBLE_ANIMATION_DURATIONS[action.type] ?? 0;
  if (action.type === 'move') {
    let steps = 12;
    if (isOnMainPath(action.from) && isOnMainPath(action.to)) {
      const indexOfTo = MAIN_PATH.indexOf(action.to);
      const indexOfFrom = MAIN_PATH.indexOf(action.from);
      steps = indexOfTo > indexOfFrom
        ? indexOfTo - indexOfFrom
        : (MAIN_PATH.length - indexOfFrom) + indexOfTo;
    }
    marbleDuration = MARBLE_ANIMATION_DURATIONS[action.type] * Math.min(steps, 12);
  }
  if (action.type === 'capture' || action.type === 'promote') {
    marbleDuration += MARBLE_ANIMATION_DURATIONS['move'] * 12;
  }
  return cardDuration + marbleDuration;
}
