import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { normalizeProfileImage } from '../services/image-utils';

interface SeedUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  picturePath?: string;
  points: number;
  ranking: number;
  lastLogin?: string;
  createdAt?: string;
}

interface BulkResult {
  id: string;
  status: 'created' | 'replaced' | 'error';
  error?: string;
}

@Component({
  selector: 'app-tmp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="padding:24px; font-family:sans-serif; max-width:900px; margin:auto;">
      <h1>TMP — Bulk seed users</h1>
      <p>
        Colle un tableau JSON d'utilisateurs ci-dessous. Chaque entrée peut avoir un champ
        <code>picturePath</code> qui correspond au <strong>nom du fichier</strong> sélectionné dans le
        champ images (ex: <code>"picturePath": "romain.jpg"</code>).
      </p>

      <label>1. Sélectionner les images locales (multi)</label>
      <input type="file" accept="image/*" multiple (change)="onFiles($event)" />
      <div *ngIf="fileNames().length" style="margin:8px 0; font-size:12px; color:#555;">
        Fichiers : {{ fileNames().join(', ') }}
      </div>

      <label style="display:block; margin-top:16px;">2. JSON</label>
      <textarea
        [(ngModel)]="jsonText"
        rows="20"
        style="width:100%; font-family:monospace; font-size:12px;"
      ></textarea>

      <div style="margin-top:12px; display:flex; gap:8px;">
        <button (click)="submit()" [disabled]="busy()">
          {{ busy() ? 'En cours…' : 'Envoyer' }}
        </button>
      </div>

      <pre *ngIf="error()" style="color:#b00; white-space:pre-wrap;">{{ error() }}</pre>

      <div *ngIf="results().length" style="margin-top:16px;">
        <h3>Résultats</h3>
        <ul>
          <li *ngFor="let r of results()">
            <strong>{{ r.id }}</strong> — {{ r.status }}
            <span *ngIf="r.error" style="color:#b00;"> ({{ r.error }})</span>
          </li>
        </ul>
      </div>
    </div>
  `,
})
export class TmpPage {
  private http = inject(HttpClient);

  jsonText = '';
  files = signal<File[]>([]);
  fileNames = signal<string[]>([]);
  busy = signal(false);
  error = signal('');
  results = signal<BulkResult[]>([]);

  onFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = Array.from(input.files ?? []);
    this.files.set(list);
    this.fileNames.set(list.map(f => f.name));
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.results.set([]);
    let users: SeedUser[];
    try {
      users = JSON.parse(this.jsonText) as SeedUser[];
      if (!Array.isArray(users)) throw new Error('Le JSON doit être un tableau');
    } catch (e) {
      this.error.set('JSON invalide: ' + (e as Error).message);
      return;
    }

    this.busy.set(true);
    try {
      const fileMap = new Map<string, File>();
      for (const f of this.files()) fileMap.set(f.name, f);

      const processed: SeedUser[] = [];
      for (const u of users) {
        const out: SeedUser = { ...u };
        if (u.picturePath) {
          const file = fileMap.get(u.picturePath);
          if (!file) {
            this.error.set(`Image introuvable pour "${u.picturePath}" (utilisateur ${u.id})`);
            this.busy.set(false);
            return;
          }
          out.picture = await normalizeProfileImage(file);
        }
        delete out.picturePath;
        processed.push(out);
      }

      const resp = await firstValueFrom(
        this.http.post<{ results: BulkResult[] }>(
          `${environment.apiUrl}/api/admin/bulk-users`,
          { users: processed },
        ),
      );
      this.results.set(resp.results);
    } catch (e) {
      this.error.set('Erreur: ' + (e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
