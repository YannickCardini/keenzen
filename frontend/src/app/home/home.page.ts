import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, NavController } from '@ionic/angular/standalone';
import { Subscription, take } from 'rxjs';
import { version } from '../../../../package.json';
import { GameStateService } from '../game/services/game-state.service';
import type { MarbleColor } from '@keezen/shared';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [IonContent, CommonModule, FormsModule],
})
export class HomePage implements OnInit, OnDestroy {
  readonly titleLetters = ['K', 'E', 'E', 'N', 'Z', 'E', 'N'];
  readonly appVersion = version;

  showLogin = false;
  showSettings = false;
  showRules = false;
  showMatchmaking = false;
  loginMode: 'login' | 'signup' = 'login';

  // ── Matchmaking state ──────────────────────────────────────────────────────
  matchmakingConnected = 0;
  matchmakingSecondsLeft = 30;
  myMatchmakingColor: MarbleColor | null = null;

  private matchmakingSub: Subscription | null = null;
  private gameStartSub: Subscription | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private navCtrl: NavController, private gameStateService: GameStateService) { }
  ngOnInit() { }

  ngOnDestroy(): void {
    this.cleanupMatchmaking();
  }

  openLogin() { this.showLogin = true; }
  closeLogin() { this.showLogin = false; }
  switchMode(mode: 'login' | 'signup') { this.loginMode = mode; }

  openSettings() { this.showSettings = true; }
  closeSettings() { this.showSettings = false; }

  openRules() { this.showRules = true; }
  closeRules() { this.showRules = false; }

  // ── Matchmaking ────────────────────────────────────────────────────────────

  openMatchmaking(): void {
    this.showMatchmaking = true;
    this.matchmakingConnected = 0;
    this.matchmakingSecondsLeft = 30;
    this.myMatchmakingColor = null;

    this.gameStateService.connect(environment.wsUrl, () => {
      this.gameStateService.sendJoinMatchmaking('Player');
    });

    this.matchmakingSub = this.gameStateService.matchmakingStatus$.subscribe(status => {
      this.matchmakingConnected = status.connectedCount;
      this.myMatchmakingColor = status.myColor;
    });

    this.gameStartSub = this.gameStateService.gameStarted$.pipe(take(1)).subscribe(() => {
      this.gameStateService.myPlayerColor.set(this.myMatchmakingColor);
      this.cleanupMatchmaking();
      this.showMatchmaking = false;
      this.navCtrl.navigateRoot(['/game']);

    });

    this.countdownInterval = setInterval(() => {
      if (this.matchmakingSecondsLeft > 0) {
        this.matchmakingSecondsLeft--;
      }
    }, 1000);
  }

  cancelMatchmaking(): void {
    this.cleanupMatchmaking();
    this.gameStateService.disconnect();
    this.showMatchmaking = false;
  }

  private cleanupMatchmaking(): void {
    this.matchmakingSub?.unsubscribe();
    this.gameStartSub?.unsubscribe();
    this.matchmakingSub = null;
    this.gameStartSub = null;
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}
