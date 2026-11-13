'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import type { AdminGroup, Category, Location } from '@/lib/client/types';

export interface AdminMeta {
  categories: Category[];
  locations: Location[];
  groups: AdminGroup[];
}

const EMPTY: AdminMeta = { categories: [], locations: [], groups: [] };

/** Category, location and group lists the admin forms need. */
export function useAdminMeta(): [AdminMeta, () => Promise<void>] {
  const [meta, setMeta] = useState<AdminMeta>(EMPTY);

  const load = useCallback(async () => {
    try {
      const [cats, locs, groups] = await Promise.all([
        api<{ categories: Category[] }>('/admin/categories'),
        api<{ locations: Location[] }>('/admin/locations'),
        api<{ groups: AdminGroup[] }>('/admin/groups'),
      ]);
      setMeta({ categories: cats.categories, locations: locs.locations, groups: groups.groups });
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  return [meta, load];
}
