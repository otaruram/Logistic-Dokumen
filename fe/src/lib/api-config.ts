/**
 * API Configuration with Hybrid Production + Development Support
 * File: fe/src/lib/api-config.ts
 */

// Detect environment
const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';

export const API_CONFIG = {
  // Development: localhost BE
  development: {
    primary: "http://localhost:8000",
    backup: "http://localhost:8000",
    cdn: "http://localhost:8000"
  },
  
  // Production: Hybrid VPS SSL primary + Render backup
  production: {
    primary: "https://api-ocr.xyz",
    backup: "https://logistic-dokumen.onrender.com", 
    cdn: "https://files.ocr.wtf"
  },
  
  // Auto-select based on environment
  get current() {
    return isDevelopment ? this.development : this.production;
  },
  
  timeout: 10000 // 10 seconds
};

let currentAPI = API_CONFIG.current.primary;
let isUsingBackup = false;

/**
 * Check if API endpoint is healthy
 */
async function checkAPIHealth(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get current API URL with automatic failover
 */
export async function getAPIURL(): Promise<string> {
  const config = API_CONFIG.current;
  
  // If we're already using backup, try to switch back to primary
  if (isUsingBackup) {
    const primaryHealthy = await checkAPIHealth(config.primary);
    if (primaryHealthy) {
      console.log("✅ Primary API restored, switching back");
      currentAPI = config.primary;
      isUsingBackup = false;
      return currentAPI;
    }
    return currentAPI; // Continue using backup
  }

  // Check primary API health
  const primaryHealthy = await checkAPIHealth(config.primary);
  if (primaryHealthy) {
    currentAPI = config.primary;
    return currentAPI;
  }

  // Primary failed, switch to backup
  console.log("⚠️ Primary API failed, switching to backup");
  const backupHealthy = await checkAPIHealth(config.backup);
  if (backupHealthy) {
    currentAPI = config.backup;
    isUsingBackup = true;
    return currentAPI;
  }

  // Both failed, return primary anyway (let error handling deal with it)
  console.error("❌ Both APIs failed!");
  return config.primary;
}

/**
 * Enhanced fetch with automatic failover
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const apiURL = await getAPIURL();
  const url = `${apiURL}${endpoint}`;
  const config = API_CONFIG.current;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok && !isUsingBackup) {
      // Try backup API
      console.log("⚠️ Primary request failed, trying backup");
      const backupURL = `${config.backup}${endpoint}`;
      const backupController = new AbortController();
      const backupTimeoutId = setTimeout(() => backupController.abort(), API_CONFIG.timeout);
      
      const backupResponse = await fetch(backupURL, {
        ...options,
        signal: backupController.signal
      });
      
      clearTimeout(backupTimeoutId);
      
      if (backupResponse.ok) {
        currentAPI = config.backup;
        isUsingBackup = true;
      }
      
      return backupResponse;
    }

    return response;
  } catch (error) {
    if (!isUsingBackup) {
      // Try backup on network error
      try {
        const backupURL = `${config.backup}${endpoint}`;
        const fallbackController = new AbortController();
        const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), API_CONFIG.timeout);
        
        const backupResponse = await fetch(backupURL, {
          ...options,
          signal: fallbackController.signal
        });
        
        clearTimeout(fallbackTimeoutId);
        
        currentAPI = config.backup;
        isUsingBackup = true;
        return backupResponse;
      } catch (backupError) {
        throw error; // Throw original error
      }
    }
    throw error;
  }
}

/**
 * Get current API status
 */
export function getAPIStatus() {
  return {
    current: currentAPI,
    isPrimary: !isUsingBackup,
    isBackup: isUsingBackup
  };
}