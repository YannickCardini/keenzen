import { Deck } from "./deck.js";
import { Player } from "./player.js";
import { AiStrategy } from "./ai-strategy.js";
import {
    getHomePositions,
    hasWon,
    TURN_DURATION_SECONDS,
    CARDS_PER_HAND,
} from '@keezen/shared';
import type { Action, Card, MarbleColor } from "@keezen/shared";

// ─── Configuration par défaut (4 IA) ─────────────────────────────────────────

const DEFAULT_PLAYER_CONFIGS: Array<{ name: string; color: MarbleColor }> = [
    { name: 'Player 1', color: 'red' },
    { name: 'Player 2', color: 'green' },
    { name: 'Player 3', color: 'blue' },
    { name: 'Player 4', color: 'orange' },
];

export class Game {

    private players: Player[];
    private turn: number = 0;
    private round: number = 0;
    private firstPlayerOfRound: number = 0;
    private currentPlayerIndex: number = 0;
    private deck: Deck;
    private ws: WebSocket;
    private discardedCards: Card[] = [];

    constructor(ws: WebSocket) {
        this.ws = ws;
        this.players = DEFAULT_PLAYER_CONFIGS.map(cfg =>
            new Player(cfg.name, cfg.color, false, new AiStrategy())
        );
        this.deck = new Deck();
        this.startGame();
    }

    // ─── Boucle principale ────────────────────────────────────────────────────

    async startGame() {
        console.log("🎮 Game started");

        this.firstPlayerOfRound = 0;
        this.currentPlayerIndex = 0;
        this.dealCards();

        while (!this.gameIsOver()) {
            if (this.allHandsEmpty()) {
                this.startNewRound();
                continue;
            }

            await this.playOneTurn();

            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            this.turn++;
        }
    }

    private startNewRound(): void {
        this.firstPlayerOfRound = (this.firstPlayerOfRound + 1) % this.players.length;
        this.currentPlayerIndex = this.firstPlayerOfRound;
        console.log(`📦 Nouvelle manche ${this.round} - Premier joueur: ${this.players[this.firstPlayerOfRound]!.name}`);
        this.dealCards();
    }

    private async playOneTurn() {
        const player = this.players[this.currentPlayerIndex]!;
        const allMarbles = this.players.flatMap(p => p.marblePositions);

        console.log(`🔄 Tour ${this.turn} (Manche ${this.round}) — ${player.name} (${player.color})`);

        // 1️⃣ Broadcast de l'état EN DÉBUT de tour
        this.broadcastState(player, 'New turn');

        // 2️⃣ Attendre l'action du joueur/IA
        const move = await this.waitForActionOrTimeout(player, allMarbles);
        const enrichedMove: Action = { ...move, playerColor: player.color };

        // 3️⃣ Mettre à jour l'état interne
        player.applyAction(enrichedMove);
        this.updateMarblePositions(player, enrichedMove);
        this.updateDiscardedCards(enrichedMove);

        // 4️⃣ Broadcast de l'action (pour animation carte + pion côté front)
        this.broadcastAction(enrichedMove);

        // 5️⃣ Attendre confirmation des animations (ou timeout fallback)
        await this.waitForAnimationsOrTimeout();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Attend l'action du joueur avec un timeout annulable.
     * Le timer est clearé dès que le joueur joue.
     */
    private waitForActionOrTimeout(player: Player, allMarbles: number[]): Promise<Action> {
        return new Promise<Action>((resolve) => {
            let settled = false;

            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                console.log(`⏰ Timeout — ${player.name} passe son tour.`);
                resolve({ type: 'pass', from: 0, to: 0, cardPlayed: null, playerColor: player.color });
            }, TURN_DURATION_SECONDS * 1000);

            player.getAction(allMarbles).then((action) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(action);
            });
        });
    }

    private broadcastAction(action: Action): void {
        this.ws.send(JSON.stringify({
            type: 'actionPlayed',
            timestamp: new Date().toISOString(),
            action,
        }));
    }

    private waitForAnimationsOrTimeout(): Promise<void> {
        const fallbackDelay = 10000;

        return new Promise<void>((resolve) => {
            let settled = false;

            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                console.log(`⏰ Animation fallback timeout (${fallbackDelay}ms)`);
                resolve();
            }, fallbackDelay);

            const onMessage = (raw: MessageEvent) => {
                try {
                    const msg = JSON.parse(raw.data as string);
                    if (msg.type === 'animationDone') {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timer);
                        this.ws.removeEventListener('message', onMessage);
                        resolve();
                    }
                } catch { /* ignore */ }
            };
            this.ws.addEventListener('message', onMessage);
        });
    }

    private updateDiscardedCards(move: Action): void {
        if (move.cardPlayed) {
            this.discardedCards.push(...move.cardPlayed);
        }
    }

    private updateMarblePositions(player: Player, move: Action): void {
        switch (move.type) {
            case 'move':
            case 'enter':
            case 'promote':
            case 'capture': {
                // 1. Déplacer l'attaquant
                const index = player.marblePositions.indexOf(move.from);
                if (index !== -1) {
                    player.marblePositions[index] = move.to;
                }

                // 2. Renvoyer le pion capturé à sa base
                for (const victim of this.players) {
                    if (victim === player) continue;

                    const victimIndex = victim.marblePositions.indexOf(move.to);
                    if (victimIndex !== -1) {
                        const homePositions = getHomePositions(victim.color);
                        const emptyHome = homePositions.find(pos => !victim.marblePositions.includes(pos));
                        if (emptyHome !== undefined) {
                            victim.marblePositions[victimIndex] = emptyHome;
                            console.log(`💀 ${player.name} a capturé un pion de ${victim.name}! Retour à la base (${emptyHome}).`);
                        }
                    }
                }
                break;
            }

            case 'swap':
                // TODO Phase 4 (carte J)
                break;

            case 'pass':
            case 'discard':
                break;
        }
    }

    private broadcastState(currentPlayer: Player, message = 'New turn'): void {
        this.ws.send(JSON.stringify({
            type: 'gameState',
            message,
            timestamp: new Date().toISOString(),
            gameState: {
                players: this.players.map(p => ({
                    name: p.name,
                    color: p.color,
                    isHuman: p.isHuman,
                    isConnected: p.isConnected,
                    marblePositions: p.marblePositions,
                    cardsLeft: p.cards.length,
                })),
                currentTurn: currentPlayer.color,
                timer: TURN_DURATION_SECONDS,
                hand: currentPlayer.cards,
                discardedCards: this.discardedCards,
            },
        }));
    }

    private allHandsEmpty(): boolean {
        return this.players.every(p => p.handEmpty());
    }

    private dealCards(): void {
        this.round++;
        if (this.deck.isEmpty()) this.deck.resetDeck();
        this.deck.shuffle();
        const cardsPerHand = this.deck.isFull() ? CARDS_PER_HAND : CARDS_PER_HAND - 1;
        for (const player of this.players) {
            player.cards = this.deck.drawCards(cardsPerHand);
        }
        console.log(`🃏 Distribution - Manche ${this.round}`);
    }

    private gameIsOver(): boolean {
        return this.players.some(p => hasWon(p.marblePositions, p.color));
    }
}
