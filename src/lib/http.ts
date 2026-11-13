import { NextResponse } from 'next/server';
import { db, ensureBoot } from './db';
import { userIdFromToken, readToken } from './auth';
import { publicUser, type PublicUser } from './util';

export interface Ctx {
  req: Request;
  params: Record<string, string>;
  query: URLSearchParams;
  user: PublicUser | null;
  token: string | null;
  body: any;
  method: string;
}

export interface ApiResult {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type Handler = (ctx: Ctx) => Promise<ApiResult | void> | ApiResult | void;

/** Load the signed in user from the session token, if any. */
export function currentUser(headers: Headers): { user: PublicUser | null; token: string | null } {
  const token = readToken(headers);
  const userId = userIdFromToken(token);
  if (!userId) return { user: null, token };
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!row || row.status !== 'active') return { user: null, token };
  return { user: publicUser(row), token };
}

export function requireAuth(ctx: Ctx): PublicUser {
  if (!ctx.user) throw Object.assign(new Error('Authentication required'), { status: 401 });
  return ctx.user;
}

export function requireRole(ctx: Ctx, ...roles: string[]): PublicUser {
  const user = requireAuth(ctx);
  if (!roles.includes(user.role)) throw Object.assign(new Error('Insufficient permissions'), { status: 403 });
  return user;
}

async function readBody(req: Request): Promise<any> {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Wrap a handler so every route shares one context builder, one error mapper
 * and one place that guarantees the database schema exists.
 */
export function route(fn: Handler) {
  return async (req: Request, segment: { params?: Record<string, string> } = {}): Promise<Response> => {
    ensureBoot();
    const url = new URL(req.url);
    const { user, token } = currentUser(req.headers);
    const ctx: Ctx = {
      req,
      params: segment.params ?? {},
      query: url.searchParams,
      user,
      token,
      body: await readBody(req),
      method: req.method,
    };
    try {
      const result = (await fn(ctx)) || {};
      const status = result.status ?? 200;
      if (status === 204) return new NextResponse(null, { status });
      const res = NextResponse.json(result.body ?? {}, { status });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    } catch (err: any) {
      const status = Number.isInteger(err?.status) ? err.status : 500;
      if (status >= 500) console.error('[error]', err);
      const res = NextResponse.json(
        { error: status >= 500 ? 'Something went wrong on the server' : err.message },
        { status },
      );
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }
  };
}
