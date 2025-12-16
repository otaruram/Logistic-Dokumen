// fe/src/lib/api-service.ts
import { API_CONFIG, getBaseUrls } from './api-config';

class ApiService {
  private primaryAPI: string;
  private backupAPI: string;
  private currentAPI: string;
  private failoverTimeout: number;

  constructor() {
    const urls = getBaseUrls();
    this.primaryAPI = urls.primary;
    this.backupAPI = urls.backup;
    this.currentAPI = this.primaryAPI;
    this.failoverTimeout = API_CONFIG.timeout;
  }

  // Cek kesehatan server
  async healthCheck(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      // Cek root endpoint atau health
      const response = await fetch(`${url}/health`, { 
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Pindah ke Backup
  async switchToBackup(): Promise<void> {
    if (this.currentAPI === this.backupAPI) return; // Sudah di backup
    
    console.log('🔄 Switching to BACKUP API:', this.backupAPI);
    this.currentAPI = this.backupAPI;
    localStorage.setItem('api_failover', 'true');
    
    window.dispatchEvent(new CustomEvent('apiFailover', { 
      detail: { api: this.backupAPI }
    }));
  }

  // Pindah ke Primary
  async switchToPrimary(): Promise<void> {
    if (this.currentAPI === this.primaryAPI) return; // Sudah di primary

    console.log('✅ Switching back to PRIMARY API:', this.primaryAPI);
    this.currentAPI = this.primaryAPI;
    localStorage.removeItem('api_failover');

    window.dispatchEvent(new CustomEvent('apiRestore', { 
      detail: { api: this.primaryAPI }
    }));
  }

  // Fungsi Utama Fetch
  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    // Pastikan endpoint diawali slash
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.currentAPI}${path}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.failoverTimeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Self-healing: Jika sukses pakai backup, coba cek primary diam-diam
      if (response.ok && this.currentAPI === this.backupAPI) {
        this.checkPrimaryRestoration();
      }

      return response;

    } catch (error) {
      console.warn(`Request failed to ${this.currentAPI}. Trying failover...`);

      // Jika gagal di Primary, coba Backup
      if (this.currentAPI === this.primaryAPI) {
        const backupHealthy = await this.healthCheck(this.backupAPI);
        if (backupHealthy) {
          await this.switchToBackup();
          // Retry request pakai backup
          return this.makeRequest(endpoint, options);
        }
      }

      throw error; // Jika dua-duanya mati, lempar error
    }
  }

  // Cek diam-diam apakah primary sudah hidup lagi
  private async checkPrimaryRestoration() {
    const isHealthy = await this.healthCheck(this.primaryAPI);
    if (isHealthy) {
      await this.switchToPrimary();
    }
  }

  // Init saat aplikasi load
  async initialize(): Promise<void> {
    const isFailover = localStorage.getItem('api_failover') === 'true';
    if (isFailover) {
      // Cek dulu apakah primary sudah sembuh sebelum pasrah pakai backup
      const primaryHealthy = await this.healthCheck(this.primaryAPI);
      if (primaryHealthy) {
        this.currentAPI = this.primaryAPI;
        localStorage.removeItem('api_failover');
      } else {
        this.currentAPI = this.backupAPI;
      }
    }
    console.log(`🚀 API Service Ready: Using ${this.currentAPI === this.primaryAPI ? 'Primary' : 'Backup'}`);
  }
}

export const apiService = new ApiService();
apiService.initialize();

// 🔥 EXPORT APIFETCH (Wrapper)
// Ini agar kamu tidak perlu ubah kodingan di Index.tsx atau komponen lain
export const apiFetch = (endpoint: string, options?: RequestInit) => {
  return apiService.makeRequest(endpoint, options);
};

export default apiService;
