// @ts-nocheck
/**
 * Simple localStorage-based caching utility with TTL (Time To Live).
 */
const DEFAULT_TTL = 1000 * 60 * 15; // 15 minutes default

export const cache = {
  /**
   * Save data to cache
   */
  set: (key: string, data: any, ttl = DEFAULT_TTL) => {
    try {
      const expires = Date.now() + ttl;
      localStorage.setItem(`hakika_cache_${key}`, JSON.stringify({ data, expires }));
    } catch (e) {
      console.warn('Cache write failed:', e);
    }
  },

  /**
   * Get data from cache, returns null if expired or not found
   */
  get: <T>(key: string): T | null => {
    try {
      const cached = localStorage.getItem(`hakika_cache_${key}`);
      if (!cached) return null;
      
      const { data, expires } = JSON.parse(cached);
      if (Date.now() > expires) {
        localStorage.removeItem(`hakika_cache_${key}`);
        return null;
      }
      return data as T;
    } catch (e) {
      console.warn('Cache read failed:', e);
      return null;
    }
  },

  /**
   * Remove a specific key from cache
   */
  remove: (key: string) => {
    localStorage.removeItem(`hakika_cache_${key}`);
  },

  /**
   * Clear all items starting with hakika_cache_
   */
  clearAll: () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('hakika_cache_')) {
        localStorage.removeItem(key);
      }
    });
  }
};
