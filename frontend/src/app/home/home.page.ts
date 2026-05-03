import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { GameRulesModalComponent } from '../shared/game-rules-modal.component';
import { Subscription, firstValueFrom, take } from 'rxjs';
import { version } from '../../../../package.json';
import { GameStateService } from '../game/services/game-state.service';
import { TabLockService } from '../game/services/tab-lock.service';
import { AuthService, type AuthUser } from '../services/auth.service';
import type { MarbleColor } from '@mercury/shared';
import { environment } from 'src/environments/environment';
import { generateGuestName } from '../shared/guest-name';
import { normalizeProfileImage } from '../services/image-utils';

interface ThreadSummary {
  peerId: string;
  peerName: string;
  peerPicture: string;
  lastMessage: { text: string; createdAt: string; fromMe: boolean };
  unreadCount: number;
}

interface ThreadMessage {
  id: string;
  fromUserId: string;
  fromName: string;
  fromPicture: string;
  toUserId: string;
  toName: string;
  toPicture: string;
  text: string;
  createdAt: string;
  read: boolean;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [CommonModule, FormsModule, GameRulesModalComponent],
})
export class HomePage implements OnInit, OnDestroy {
  readonly titleLetters = ['M', 'E', 'R', 'C', 'U', 'R', 'Y'];
  readonly appVersion = version;

  showLogin = false;
  showSettings = false;
  showRules = false;
  showMatchmaking = false;
  loginMode: 'login' | 'signup' = 'login';
  activeGame = false;

  // ── Edit profile state ─────────────────────────────────────────────────────
  editingProfile = false;
  editName = '';
  editPreviewUrl = '';
  editPictureDataUrl = '';
  isSaving = false;
  isProcessingImage = false;
  editError = '';
  private updateErrorSub: Subscription | null = null;

  // ── Matchmaking state ──────────────────────────────────────────────────────
  matchmakingConnected = 0;
  myMatchmakingColor: MarbleColor | null = null;

  private matchmakingSub: Subscription | null = null;
  private gameStartSub: Subscription | null = null;
  private connectionErrorSub: Subscription | null = null;
  private loginErrorSub: Subscription | null = null;

  /** Shown when the user tries to open matchmaking while another tab is active. */
  duplicateTabMessage = false;
  /** Shown when the WebSocket fails to connect. */
  matchmakingError = false;

  loginError = false;
  loginErrorMessage = '';

  // ── Inbox state ────────────────────────────────────────────────────────────
  showInbox = false;
  inboxView: 'threads' | 'thread' = 'threads';
  threads: ThreadSummary[] = [];
  threadsLoading = false;
  inboxError = '';
  unreadCount = 0;

  // Active thread (when inboxView === 'thread')
  currentPeer: { id: string; name: string; picture: string } | null = null;
  currentMessages: ThreadMessage[] = [];
  threadLoading = false;
  composerText = '';
  sending = false;
  readonly composerMaxLength = 500;

  @ViewChild('threadScroll') threadScroll?: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);
  private userSub: Subscription | null = null;

  constructor(
    private router: Router,
    private gameStateService: GameStateService,
    private tabLock: TabLockService,
    readonly auth: AuthService,
  ) { }

  private hasActiveGame(): boolean {
    return !!(localStorage.getItem('active_game_id') && localStorage.getItem('guest_player_id'));
  }

  ngOnInit(): void {
    this.activeGame = this.hasActiveGame();
    this.loginErrorSub = this.auth.loginError$.subscribe(type => {
      this.loginErrorMessage = type === 'server'
        ? 'Server error. Please try again later.'
        : 'Could not sign in with Google. Please try again.';
      this.loginError = true;
      setTimeout(() => this.loginError = false, 4000);
    });
    this.updateErrorSub = this.auth.updateError$.subscribe(msg => {
      this.editError = msg;
    });
    this.userSub = this.auth.user$.subscribe(user => {
      if (user) {
        void this.refreshUnreadCount();
      } else {
        this.unreadCount = 0;
        this.threads = [];
        this.currentMessages = [];
        this.currentPeer = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupMatchmaking();
    this.loginErrorSub?.unsubscribe();
    this.updateErrorSub?.unsubscribe();
    this.userSub?.unsubscribe();
  }

  openLogin() { this.showLogin = true; }
  closeLogin() { this.showLogin = false; this.editingProfile = false; this.editError = ''; }
  switchMode(mode: 'login' | 'signup') { this.loginMode = mode; }

  toggleEditProfile(user: AuthUser): void {
    this.editingProfile = !this.editingProfile;
    if (this.editingProfile) {
      this.editName = user.name;
      this.editPreviewUrl = user.picture;
      this.editPictureDataUrl = user.picture;
      this.editError = '';
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.editError = '';
    this.isProcessingImage = true;
    try {
      const dataUrl = await normalizeProfileImage(file);
      this.editPreviewUrl = dataUrl;
      this.editPictureDataUrl = dataUrl;
    } catch (err) {
      this.editError = err instanceof Error && err.message === 'Could not read image.'
        ? 'Could not read image.'
        : 'Could not process image, please try another file.';
    } finally {
      this.isProcessingImage = false;
      input.value = '';
    }
  }

  async saveProfile(): Promise<void> {
    if (this.isSaving) return;
    this.isSaving = true;
    this.editError = '';
    try {
      await this.auth.updateProfile(this.editName, this.editPictureDataUrl);
      this.editingProfile = false;
    } catch {
      // editError already set via updateError$ subscription
    } finally {
      this.isSaving = false;
    }
  }

  async loginWithGoogle(): Promise<void> {
    try {
      await this.auth.login();
      this.closeLogin();
    } catch (err) {
      console.error('Google login error:', err);
      this.loginErrorMessage = 'Could not sign in with Google. Please try again.';
      this.loginError = true;
      setTimeout(() => this.loginError = false, 4000);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }

  resumeGame(): void { this.router.navigate(['/game']); }

  openSettings() { this.showSettings = true; }
  closeSettings() { this.showSettings = false; }

  openRules() { this.showRules = true; }
  closeRules() { this.showRules = false; }
  goToLeaderboard() { this.router.navigate(['/leaderboard']); }

  // ── Matchmaking ────────────────────────────────────────────────────────────

  async openMatchmaking(): Promise<void> {
    if (this.hasActiveGame()) {
      this.router.navigate(['/game']);
      return;
    }

    // Prevent duplicate matchmaking from multiple tabs
    if (await this.tabLock.isOtherTabActive()) {
      this.duplicateTabMessage = true;
      setTimeout(() => this.duplicateTabMessage = false, 4000);
      return;
    }

    this.tabLock.claimSession();
    this.showMatchmaking = true;
    this.matchmakingConnected = 0;
    this.myMatchmakingColor = null;

    const user = this.auth.user$.getValue();
    const playerName = user?.name ?? generateGuestName();
    const playerPicture = user?.picture;
    const userId = user?.id;
    this.gameStateService.connect(environment.wsUrl, () => {
      this.gameStateService.sendJoinMatchmaking(playerName, playerPicture, userId);
    });

    this.matchmakingSub = this.gameStateService.matchmakingStatus$.subscribe(status => {
      this.matchmakingConnected = status.connectedCount;
      this.myMatchmakingColor = status.myColor;
    });

    this.gameStartSub = this.gameStateService.gameStarted$.pipe(take(1)).subscribe(() => {
      this.gameStateService.myPlayerColor.set(this.myMatchmakingColor);
      this.cleanupMatchmaking();
      this.showMatchmaking = false;
      this.router.navigate(['/game']);
    });

    this.connectionErrorSub = this.gameStateService.connectionError$.pipe(take(1)).subscribe(() => {
      this.cleanupMatchmaking();
      this.gameStateService.disconnect();
      this.tabLock.releaseSession();
      this.showMatchmaking = false;
      this.matchmakingError = true;
      setTimeout(() => this.matchmakingError = false, 4000);
    });

  }

  cancelMatchmaking(): void {
    this.cleanupMatchmaking();
    this.gameStateService.disconnect();
    this.tabLock.releaseSession();
    this.showMatchmaking = false;
  }

  private cleanupMatchmaking(): void {
    this.matchmakingSub?.unsubscribe();
    this.gameStartSub?.unsubscribe();
    this.connectionErrorSub?.unsubscribe();
    this.matchmakingSub = null;
    this.gameStartSub = null;
    this.connectionErrorSub = null;
  }

  // ── Inbox ──────────────────────────────────────────────────────────────────

  private authHeaders(): { Authorization: string } | null {
    const idToken = this.auth.getIdToken();
    return idToken ? { Authorization: `Bearer ${idToken}` } : null;
  }

  private async refreshUnreadCount(): Promise<void> {
    const headers = this.authHeaders();
    if (!headers) {
      this.unreadCount = 0;
      return;
    }
    try {
      const res = await firstValueFrom(
        this.http.get<{ count: number }>(`${environment.apiUrl}/api/messages/unread-count`, { headers })
      );
      this.unreadCount = res.count ?? 0;
    } catch {
      // Silently ignore — the badge just won't appear.
    }
  }

  async openInbox(): Promise<void> {
    if (!this.auth.user$.getValue()) return;
    this.showInbox = true;
    this.inboxView = 'threads';
    this.currentPeer = null;
    this.currentMessages = [];
    void this.loadThreads();
  }

  private async loadThreads(): Promise<void> {
    const headers = this.authHeaders();
    if (!headers) {
      this.inboxError = 'Please sign in again to view your messages.';
      this.threadsLoading = false;
      return;
    }
    this.inboxError = '';
    this.threadsLoading = true;
    try {
      const list = await firstValueFrom(
        this.http.get<ThreadSummary[]>(`${environment.apiUrl}/api/messages/threads`, { headers })
      );
      this.threads = list;
    } catch {
      this.inboxError = 'Could not load your conversations.';
    } finally {
      this.threadsLoading = false;
    }
  }

  closeInbox(): void {
    this.showInbox = false;
  }

  async openThread(thread: ThreadSummary): Promise<void> {
    this.currentPeer = {
      id: thread.peerId,
      name: thread.peerName,
      picture: thread.peerPicture,
    };
    this.currentMessages = [];
    this.composerText = '';
    this.inboxView = 'thread';
    this.threadLoading = true;

    const headers = this.authHeaders();
    if (!headers) {
      this.threadLoading = false;
      this.inboxError = 'Please sign in again.';
      return;
    }

    try {
      const messages = await firstValueFrom(
        this.http.get<ThreadMessage[]>(
          `${environment.apiUrl}/api/messages/thread/${encodeURIComponent(thread.peerId)}`,
          { headers }
        )
      );
      this.currentMessages = messages;
      this.threadLoading = false;
      this.scrollThreadToBottom();

      // Mark this peer's messages as read.
      if (thread.unreadCount > 0) {
        try {
          await firstValueFrom(
            this.http.post(
              `${environment.apiUrl}/api/messages/mark-read`,
              { peerId: thread.peerId },
              { headers }
            )
          );
          this.currentMessages = this.currentMessages.map(m =>
            m.fromUserId === thread.peerId ? { ...m, read: true } : m
          );
          // Update local thread summary's unreadCount and global counter.
          this.threads = this.threads.map(t =>
            t.peerId === thread.peerId ? { ...t, unreadCount: 0 } : t
          );
          void this.refreshUnreadCount();
        } catch {
          // Non-fatal.
        }
      }
    } catch {
      this.threadLoading = false;
      this.inboxError = 'Could not load this conversation.';
    }
  }

  backToThreads(): void {
    this.inboxView = 'threads';
    this.currentPeer = null;
    this.currentMessages = [];
    this.composerText = '';
    void this.loadThreads();
  }

  isMyMessage(msg: ThreadMessage): boolean {
    const me = this.auth.user$.getValue();
    return !!me && msg.fromUserId === me.id;
  }

  async sendThreadReply(): Promise<void> {
    if (this.sending) return;
    const peer = this.currentPeer;
    if (!peer) return;
    const text = this.composerText.trim();
    if (!text || text.length > this.composerMaxLength) return;

    const headers = this.authHeaders();
    if (!headers) {
      this.inboxError = 'Please sign in again.';
      return;
    }

    this.sending = true;
    try {
      const created = await firstValueFrom(
        this.http.post<ThreadMessage>(
          `${environment.apiUrl}/api/messages`,
          { toUserId: peer.id, text },
          { headers }
        )
      );
      this.currentMessages = [...this.currentMessages, created];
      this.composerText = '';
      this.scrollThreadToBottom();
    } catch {
      this.inboxError = 'Could not send your message.';
      setTimeout(() => { this.inboxError = ''; }, 3000);
    } finally {
      this.sending = false;
    }
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.sendThreadReply();
    }
  }

  private scrollThreadToBottom(): void {
    setTimeout(() => {
      const el = this.threadScroll?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  formatInboxDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatBubbleTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  openSenderProfile(userId: string | null | undefined): void {
    if (!userId) return;
    this.closeInbox();
    void this.router.navigate(['/profile', userId]);
  }
}
