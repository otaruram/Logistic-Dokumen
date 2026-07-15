/**
 * Frontend caching service for API responses
 * Caches fraud analysis, DGTNZ scans, Telegram profile, and Otaru insights
 * Cache expires after 5 minutes (300000 ms) or when data differs
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hash: string;
}

interface CacheConfig {
  ttl: number; // milliseconds
}

const DEFAULT_CONFIG: CacheConfig = {
  ttl: 5 * 60 * 1000, // 5 minutes
};

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate hash from data for change detection
   */
  private hash(data: any): string {
    try {
      return btoa(JSON.stringify(data)).slice(0, 16);
    } catch {
      return "hash_error";
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > this.config.ttl;
  }

  /**
   * Get cached data if valid and unchanged
   */
  get<T>(key: string, currentData?: any): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    // If new data provided, check if it matches cached hash
    if (currentData !== undefined) {
      const newHash = this.hash(currentData);
      if (newHash === entry.hash) {
        return entry.data; // Data unchanged
      }
      return null; // Data changed
    }

    return entry.data;
  }

  /**
   * Set cache with automatic hash
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hash: this.hash(data),
    });
  }

  /**
   * Clear specific cache key
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const appCache = new CacheService();

/**
 * Cache key generators for consistent naming
 */
export const cacheKeys = {
  fraudAnalysis: (userId: string, scanId: string) =>
    `fraud:${userId}:${scanId}`,
  dgtnzAnalysis: (userId: string, scanId: string) =>
    `dgtnz:${userId}:${scanId}`,
  telegramProfile: (userId: string) =>
    `telegram:${userId}:profile`,
  otaruInsight: (userId: string, scanId: string) =>
    `otaru:${userId}:${scanId}`,
  fraudHistory: (userId: string) =>
    `fraud:${userId}:history`,
  dgtnzHistory: (userId: string) =>
    `dgtnz:${userId}:history`,
};
