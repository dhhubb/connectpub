import { db } from '@/lib/db';
import { route } from '@/lib/http';
import type { Row } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Row[];
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  return { body: { settings } };
});
