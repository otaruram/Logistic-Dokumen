/**
 * API Failover Service for Hybrid System
 * Primary: VPS (api-ocr.xyz) 
 * Backup: Render (logistic-dokumen.onrender.com)
 */

class ApiService {
  private primaryAPI: string;
  private backupAPI: string;
  private currentAPI: string;
  private failoverTimeout: number;

  constructor() {
    this.primaryAPI = import.meta.env.VITE_API_URL || 'https://api-ocr.xyz';
    this.backupAPI = import.meta.env.VITE_BACKUP_API_URL || 'https://logistic-dokumen.onrender.com';
    this.currentAPI = this.primaryAPI;
    this.failoverTimeout = 5000; // 5 seconds
  }

  async healthCheck(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${url}/health`, { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn(`Health check failed for ${url}:`, error);
      return false;
    }
  }

  async switchToBackup(): Promise<void> {
    console.log('🔄 Switching to backup API:', this.backupAPI);
    this.currentAPI = this.backupAPI;
    
    // Store failover state
    localStorage.setItem('api_failover', 'true');
    localStorage.setItem('api_current', this.backupAPI);
    
    // Dispatch event for UI notification
    window.dispatchEvent(new CustomEvent('apiFailover', { 
      detail: { api: this.backupAPI, reason: 'Primary API unavailable' }
    }));
  }

  async switchToPrimary(): Promise<void> {
    console.log('✅ Switching back to primary API:', this.primaryAPI);
    this.currentAPI = this.primaryAPI;
    
    // Clear failover state
    localStorage.removeItem('api_failover');
    localStorage.removeItem('api_current');
    
    // Dispatch event for UI notification
    window.dispatchEvent(new CustomEvent('apiRestore', { 
      detail: { api: this.primaryAPI }
    }));
  }

  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.currentAPI}${endpoint}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.failoverTimeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // If successful and we're on backup, try to switch back to primary
      if (response.ok && this.currentAPI === this.backupAPI) {
        const primaryHealthy = await this.healthCheck(this.primaryAPI);
        if (primaryHealthy) {
          await this.switchToPrimary();
        }
      }
      
      return response;
      
    } catch (error) {
      console.error(`Request failed to ${this.currentAPI}:`, error);
      
      // If primary fails, switch to backup
      if (this.currentAPI === this.primaryAPI) {
        const backupHealthy = await this.healthCheck(this.backupAPI);
        if (backupHealthy) {
          await this.switchToBackup();
          // Retry request with backup API
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.failoverTimeout);
          
          const retryResponse = await fetch(`${this.currentAPI}${endpoint}`, {
            ...options,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          return retryResponse;
        }
      }
      
      throw error;
    }
  }

  getCurrentAPI(): string {
    return this.currentAPI;
  }

  isUsingBackup(): boolean {
    return this.currentAPI === this.backupAPI;
  }

  // Initialize on page load
  async initialize(): Promise<void> {
    // Check if we were previously using backup
    const storedAPI = localStorage.getItem('api_current');
    if (storedAPI === this.backupAPI) {
      this.currentAPI = this.backupAPI;
    }
    
    // Health check both APIs
    const primaryHealthy = await this.healthCheck(this.primaryAPI);
    const backupHealthy = await this.healthCheck(this.backupAPI);
    
    // Use primary if healthy, otherwise backup
    if (primaryHealthy) {
      this.currentAPI = this.primaryAPI;
      localStorage.removeItem('api_failover');
    } else if (backupHealthy) {
      this.currentAPI = this.backupAPI;
      localStorage.setItem('api_failover', 'true');
    }
    
    console.log(`🚀 API Service initialized: ${this.currentAPI}`);
    console.log(`📊 Primary (${this.primaryAPI}): ${primaryHealthy ? '✅' : '❌'}`);
    console.log(`📊 Backup (${this.backupAPI}): ${backupHealthy ? '✅' : '❌'}`);
  }
}

// Global instance
export const apiService = new ApiService();

// Auto-initialize
apiService.initialize();

export default apiService;