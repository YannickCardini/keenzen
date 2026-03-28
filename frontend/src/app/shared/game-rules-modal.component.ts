import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game-rules-modal',
  templateUrl: './game-rules-modal.component.html',
  styleUrl: './game-rules-modal.component.scss',
  standalone: true,
  imports: [CommonModule],
})
export class GameRulesModalComponent {
  @Input() show = false;
  @Output() closeModal = new EventEmitter<void>();
}
