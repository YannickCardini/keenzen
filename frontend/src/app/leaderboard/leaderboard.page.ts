import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

interface LeaderboardEntry {
  name: string;
  picture: string;
  points: number;
  ranking: number;
}

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.page.html',
  styleUrls: ['./leaderboard.page.scss'],
  imports: [CommonModule],
})
export class LeaderboardPage implements OnInit {
  private http = inject(HttpClient);
  private location = inject(Location);

  entries = signal<LeaderboardEntry[]>([]);
  loading = signal(true);
  error = signal('');

  ngOnInit(): void {
    firstValueFrom(
      this.http.get<LeaderboardEntry[]>(`${environment.apiUrl}/api/auth/leaderboard`)
    ).then(data => {
      this.entries.set(data);
      this.loading.set(false);
    }).catch(() => {
      this.error.set('Could not load leaderboard.');
      this.loading.set(false);
    });
  }

  goBack(): void {
    this.location.back();
  }
}
