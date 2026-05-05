import { Router, type Request, type Response } from 'express';
import { getUsersContainer } from '../db.js';

const router = Router();

interface BulkUserInput {
    id: string;
    email: string;
    name: string;
    picture: string;
    points: number;
    ranking: number;
    lastLogin?: string;
    createdAt?: string;
}

// POST /api/admin/bulk-users — temporary endpoint to seed users.
router.post('/bulk-users', async (req: Request, res: Response) => {
    const body = req.body as { users?: BulkUserInput[] };
    const users = body.users;
    if (!Array.isArray(users) || users.length === 0) {
        res.status(400).json({ error: 'users must be a non-empty array' });
        return;
    }

    const results: { id: string; status: 'created' | 'replaced' | 'error'; error?: string }[] = [];

    try {
        const container = await getUsersContainer();
        for (const u of users) {
            if (!u.id || !u.email || !u.name) {
                results.push({ id: u.id ?? '?', status: 'error', error: 'Missing id/email/name' });
                continue;
            }
            const now = new Date().toISOString();
            const doc = {
                id: String(u.id),
                email: u.email,
                name: u.name,
                picture: u.picture ?? '',
                points: typeof u.points === 'number' ? u.points : 0,
                ranking: typeof u.ranking === 'number' ? u.ranking : 0,
                lastLogin: u.lastLogin ?? now,
                createdAt: u.createdAt ?? now,
            };
            try {
                let existed = false;
                try {
                    const { resource } = await container.item(doc.id, doc.id).read();
                    existed = !!resource;
                } catch (err: unknown) {
                    if ((err as { code?: number }).code !== 404) throw err;
                }
                if (existed) {
                    await container.item(doc.id, doc.id).replace(doc);
                    results.push({ id: doc.id, status: 'replaced' });
                } else {
                    await container.items.create(doc);
                    results.push({ id: doc.id, status: 'created' });
                }
            } catch (err) {
                console.error('❌ bulk-users insert error:', err);
                results.push({ id: doc.id, status: 'error', error: (err as Error).message });
            }
        }
        res.json({ results });
    } catch (err) {
        console.error('❌ Cosmos DB error (bulk-users):', err);
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
