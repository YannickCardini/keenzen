import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { GameStateService } from './services/game-state.service';

export const gameGuard: CanActivateFn = () => {
  const router = inject(Router);
  const gameState = inject(GameStateService);

  // Allow if WebSocket is already connected (e.g. coming from matchmaking)
  if (gameState.isConnected()) {
    return true;
  }

  // Allow if localStorage has a valid session (reconnection after page refresh)
  const activeGameId = localStorage.getItem('active_game_id');
  const guestPlayerId = localStorage.getItem('guest_player_id');
  if (activeGameId && guestPlayerId) {
    return true;
  }

  return router.createUrlTree(['/home']);
};