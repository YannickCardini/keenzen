import {
    getLegalAction,
    findLegalMoveForCard,
    getLegalSplit7Action,
    MAIN_PATH,
    type LegalMoveContext,
} from '@mercury/shared';

export { getLegalAction, findLegalMoveForCard, getLegalSplit7Action, MAIN_PATH };
export type { LegalMoveContext };

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
