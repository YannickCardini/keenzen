import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, ViewDidEnter } from '@ionic/angular/standalone';
import { BoardComponent } from './components/board/board.component';
import { TableComponent } from './components/table/table.component';
import { GameStateService } from './services/game-state.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrl: 'home.page.scss',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, BoardComponent, TableComponent],
})
export class HomePage implements ViewDidEnter {

  constructor(public gameStateService: GameStateService) { }
  ionViewDidEnter(): void {
    this.connect();
  }

  connect() {
    this.gameStateService.connect('ws://localhost:8080');
  }

  disconnect() {
    this.gameStateService.disconnect()
  }
}

