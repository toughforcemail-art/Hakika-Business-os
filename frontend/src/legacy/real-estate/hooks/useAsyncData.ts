// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList, Dispatch, SetStateAction } from 'react';
import { isAbortError } from '../utils/abortErrors';

interface UseAsyncDataOptions<T> {
  immediate?: boolean;
  initialData: T;
}

interface UseAsyncDataState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  run: () => Promise<T>;
  setData: Dispatch<SetStateAction<T>>;
}

export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  options: UseAsyncDataOptions<T>
): UseAsyncDataState<T> {
  const { immediate = true, initialData } = options;
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const dataRef = useRef<T>(initialData);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await loader();
      if (mountedRef.current) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (isAbortError(err)) {
        return dataRef.current;
      }
      const message = err instanceof Error ? err.message : 'Something went wrong while loading data.';
      if (mountedRef.current) {
        setError(message);
      }
      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    if (!immediate) {
      setLoading(false);
      return;
    }

    void run();
  }, [immediate, run]);

  return {
    data,
    loading,
    error,
    run,
    setData,
  };
}
