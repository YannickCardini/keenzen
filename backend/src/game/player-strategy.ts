import type { Action, Card } from '@mercury/shared';
import type { LegalMoveContext } from '../utils/utils.js';

/**
 * Contrat commun pour toute "intelligence" de joueur.
 * Implémentations actuelles : AiStrategy
 * Prévues en Phase 3    : HumanStrategy
 *
 * La strategy ne doit PAS modifier la main du joueur (hand).
 * C'est Player.applyAction() qui s'en charge après coup.
 */
export interface PlayerStrategy {
    getAction(ctx: LegalMoveContext, hand: Card[]): Promise<Action>;
}
