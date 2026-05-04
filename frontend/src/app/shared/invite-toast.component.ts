import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { GameInviteMessage } from '@mercury/shared';

const AUTO_DISMISS_MS = 15_000;

/**
 * Bottom-right toast that appears when a `gameInvite` is pushed to the user.
 * Provides a one-click "Join" and a "Decline" button, and auto-dismisses
 * after 15 seconds (counts as a decline).
 */
@Component({
  selector: 'app-invite-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invite-toast.component.html',
  styleUrls: ['./invite-toast.component.scss'],
})
export class InviteToastComponent implements OnChanges, OnDestroy {
  @Input() invite: GameInviteMessage | null = null;
  @Output() join = new EventEmitter<GameInviteMessage>();
  @Output() decline = new EventEmitter<GameInviteMessage>();

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!('invite' in changes)) return;
    this.clearTimer();
    if (this.invite) {
      const captured = this.invite;
      this.timer = setTimeout(() => {
        if (this.invite === captured) this.decline.emit(captured);
      }, AUTO_DISMISS_MS);
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  onJoin(): void {
    if (!this.invite) return;
    const inv = this.invite;
    this.clearTimer();
    this.join.emit(inv);
  }

  onDecline(): void {
    if (!this.invite) return;
    const inv = this.invite;
    this.clearTimer();
    this.decline.emit(inv);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
