'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import type { Category, Location } from '@/lib/client/types';

export interface DashboardMeta {
  jobCategories: Category[];
  serviceCategories: Category[];
  locations: Location[];
}

const EMPTY: DashboardMeta = { jobCategories: [], serviceCategories: [], locations: [] };

/** Load the category and location lists the listing forms need, once per mount. */
export function useDashboardMeta(): [DashboardMeta, () => Promise<void>] {
  const [meta, setMeta] = useState<DashboardMeta>(EMPTY);

  const load = async () => {
    try {
      const [jc, sc, locs] = await Promise.all([
        api<{ categories: Category[] }>('/meta/categories?kind=job'),
        api<{ categories: Category[] }>('/meta/categories?kind=service'),
        api<{ locations: Location[] }>('/meta/locations'),
      ]);
      setMeta({ jobCategories: jc.categories, serviceCategories: sc.categories, locations: locs.locations });
    } catch { /* keep defaults */ }
  };

  useEffect(() => { load(); }, []);

  return [meta, load];
}
