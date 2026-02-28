import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Runs a callback when the screen gains focus, but only if the data is stale.
 * Uses stale-while-revalidate pattern:
 *  - If data < freshThreshold: skip fetch entirely
 *  - If data >= freshThreshold: call the fetch callback
 *
 * @param fetchCallback - async function to call when data is stale
 * @param freshThresholdMs - how long data is considered fresh (default 30s)
 */
export function useStaleFocusEffect(
  fetchCallback: () => void | Promise<void>,
  freshThresholdMs: number = 30_000,
) {
  const lastFetchTime = useRef<number>(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchTime.current >= freshThresholdMs) {
        lastFetchTime.current = now;
        fetchCallback();
      }
    }, [fetchCallback, freshThresholdMs]),
  );
}
