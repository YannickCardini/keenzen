import { Injectable, signal } from '@angular/core';

const CHANNEL_NAME = 'mercury-session';
const QUERY_TIMEOUT_MS = 150;

/**
 * Coordinates between browser tabs to prevent duplicate matchmaking entries
 * and duplicate game connections. Uses BroadcastChannel API.
 */
@Injectable({ providedIn: 'root' })
export class TabLockService {

  /** True when this tab owns the active session (matchmaking or game). */
  readonly isSessionOwner = signal(false);

  /** Set to true when another tab has replaced this tab's session. */
  readonly wasReplaced = signal(false);

  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent) => this.handleMessage(event.data);
    }
  }

  /**
   * Check if another tab currently holds an active session.
   * Sends a query and waits briefly for a response.
   */
  async isOtherTabActive(): Promise<boolean> {
    if (!this.channel) return false;

    return new Promise<boolean>((resolve) => {
      let received = false;

      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'session-active') {
          received = true;
        }
      };

      this.channel!.addEventListener('message', handler);
      this.channel!.postMessage({ type: 'session-query' });

      setTimeout(() => {
        this.channel!.removeEventListener('message', handler);
        resolve(received);
      }, QUERY_TIMEOUT_MS);
    });
  }

  /** Claim the session for this tab. Other tabs will be notified. */
  claimSession(): void {
    this.isSessionOwner.set(true);
    this.wasReplaced.set(false);
    this.channel?.postMessage({ type: 'session-claimed' });
  }

  /** Release the session (game ended, cancelled, etc.). */
  releaseSession(): void {
    this.isSessionOwner.set(false);
    this.channel?.postMessage({ type: 'session-released' });
  }

  private handleMessage(data: any): void {
    if (!data?.type) return;

    switch (data.type) {
      case 'session-query':
        if (this.isSessionOwner()) {
          this.channel?.postMessage({ type: 'session-active' });
        }
        break;

      case 'session-claimed':
        if (this.isSessionOwner()) {
          this.isSessionOwner.set(false);
          this.wasReplaced.set(true);
        }
        break;
    }
  }
}
