import { route } from '@/lib/http';
import { DB_PATH } from '@/lib/db';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ({
  body: {
    ok: true,
    service: 'plumtree-connect',
    database: path.basename(DB_PATH),
    time: new Date().toISOString(),
  },
}));
