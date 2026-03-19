import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { cacheGet, cacheSet } from './cache';

interface UseCachedFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches data from the API with TTL-based caching.
 * Serves stale data immediately while revalidating in the background.
 *
 * @param url     API path (relative to base URL)
 * @param ttlMs   Cache TTL in milliseconds (default: 5 minutes)
 */
export function useCachedFetch<T>(
  url: string | null,
  ttlMs = 5 * 60 * 1000
): UseCachedFetchResult<T> {
  const [data, setData] = useState<T | null>(() => (url ? cacheGet<T>(url) : null));
  const [loading, setLoading] = useState<boolean>(!data && !!url);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const fetch = useCallback(
    async (silent = false) => {
      if (!urlRef.current) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await api.get(urlRef.current);
        const result: T = res.data.data ?? res.data;
        cacheSet(urlRef.current, result, ttlMs);
        setData(result);
      } catch (e: any) {
        setError(e.response?.data?.error?.message ?? 'Failed to load data');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [ttlMs]
  );

  useEffect(() => {
    if (!url) return;
    const cached = cacheGet<T>(url);
    if (cached) {
      setData(cached);
      // Revalidate silently in background
      fetch(true);
    } else {
      fetch(false);
    }
  }, [url, fetch]);

  return { data, loading, error, refetch: () => fetch(false) };
}
