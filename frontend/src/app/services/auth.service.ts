import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { environment } from 'src/environments/environment';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    picture: string;
    points: number;
    ranking: number;
}

const STORAGE_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private http = inject(HttpClient);

    readonly user$ = new BehaviorSubject<AuthUser | null>(this.loadStoredUser());

    constructor() {
        void GoogleSignIn.initialize({
            clientId: environment.googleClientId,
            redirectUrl: window.location.origin,
        });

        // On web, signIn() redirects the page to Google and the promise never resolves.
        // When Google redirects back, the id_token is in the URL hash — handle it here.
        if (window.location.hash.includes('id_token')) {
            void this.handleRedirectCallback();
        }
    }

    async login(): Promise<void> {
        // Navigates the page to Google OAuth — never resolves on web
        await GoogleSignIn.signIn();
    }

    async logout(): Promise<void> {
        await GoogleSignIn.signOut();
        this.user$.next(null);
        localStorage.removeItem(STORAGE_KEY);
    }

    private async handleRedirectCallback(): Promise<void> {
        try {
            const { idToken } = await GoogleSignIn.handleRedirectCallback();
            const user = await firstValueFrom(
                this.http.post<AuthUser>(`${environment.apiUrl}/api/auth/google`, { idToken })
            );
            this.user$.next(user);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        } catch (err) {
            console.error('Google redirect callback error:', err);
        }
    }

    private loadStoredUser(): AuthUser | null {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? (JSON.parse(stored) as AuthUser) : null;
    }
}
