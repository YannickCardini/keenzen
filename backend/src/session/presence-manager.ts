// ─────────────────────────────────────────────────────────────────────────────
// PresenceManager — registre des sockets actifs par userId.
//
// Permet au serveur de pousser des notifications (ex: invitations à une partie
// custom) à un utilisateur connecté quel que soit son état (idle sur la home,
// dans une custom room, en matchmaking, …). Un même userId peut avoir plusieurs
// sockets ouverts (multi-onglet) — la notif est diffusée à tous.
// ─────────────────────────────────────────────────────────────────────────────

export class PresenceManager {

    private byUserId = new Map<string, Set<WebSocket>>();
    private byWs = new Map<WebSocket, string>();

    register(userId: string, ws: WebSocket): void {
        const existing = this.byWs.get(ws);
        if (existing === userId) return;
        if (existing) this.unregister(ws);

        let set = this.byUserId.get(userId);
        if (!set) {
            set = new Set();
            this.byUserId.set(userId, set);
        }
        set.add(ws);
        this.byWs.set(ws, userId);
    }

    unregister(ws: WebSocket): void {
        const userId = this.byWs.get(ws);
        if (!userId) return;
        const set = this.byUserId.get(userId);
        if (set) {
            set.delete(ws);
            if (set.size === 0) this.byUserId.delete(userId);
        }
        this.byWs.delete(ws);
    }

    /** Returns true if the message was delivered to at least one socket. */
    send(userId: string, msg: object): boolean {
        const set = this.byUserId.get(userId);
        if (!set || set.size === 0) return false;
        const json = JSON.stringify(msg);
        let sent = false;
        for (const ws of set) {
            try {
                ws.send(json);
                sent = true;
            } catch { /* ignore */ }
        }
        return sent;
    }
}
