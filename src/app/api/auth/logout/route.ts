import { destroySession } from '@/lib/auth';
import { route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const POST = route(async (ctx) => {
  destroySession(ctx.token);
  return { body: { ok: true } };
});
