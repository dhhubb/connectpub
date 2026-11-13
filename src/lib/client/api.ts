'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'seeker' | 'employer' | 'provider' | 'admin';
  status: string;
  ward: string | null;
  bio: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

const TOKEN_KEY = 'pc_token';
const USER_KEY = 'pc_user';

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function storeSession(token: string | null, user: SessionUser | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_KEY);
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function api<T = any>(path: string, { method = 'GET', body, headers = {} }: ApiOptions = {}): Promise<T> {
  const opts: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined) {
    (opts.headers as Record<string, string>)['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const token = getToken();
  if (token) (opts.headers as Record<string, string>)['Authorization'] = 'Bearer ' + token;
  const res = await fetch('/api' + path, opts);
  const text = await res.text();
  let data: any = null;
  if (text) { try { data = JSON.parse(text); } catch { data = { error: text }; } }
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/auth/login')) {
      storeSession(null, null);
      window.dispatchEvent(new Event('pc:session'));
    }
    throw new ApiError((data && (data.error || data.message)) || `Request failed (${res.status})`, res.status, data || {});
  }
  return (data || {}) as T;
}

/** Build a query string from a filter object, dropping empty values. */
export function toQuery(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

/** Debounce a callback, returning a stable debounced function. */
export function useDebounced<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), wait);
  }, [wait]);
}

/** Read a URL search param once mounted. */
export function readParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

/** Replace the current URL's query string without a navigation. */
export function setQuery(params: Record<string, string | number | null | undefined>) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  window.history.replaceState({}, '', url);
}
