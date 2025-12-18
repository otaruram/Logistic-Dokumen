// fe/src/lib/api-config.ts

// Detect environment (Dev di laptop atau Prod di server)
const isDevelopment = import.meta.env.DEV;

export const API_CONFIG = {
  // Konfigurasi saat Development (Laptop)
  development: {
    primary: import.meta.env.VITE_API_DEV_PRIMARY || "http://localhost:8000",
    backup: import.meta.env.VITE_API_DEV_BACKUP || ""
  },
  
  // Konfigurasi saat Production (Live User)
  production: {
    // Kalau lupa set di Vercel, dia bakal error/kosong (sebagai pengingat)
    primary: import.meta.env.VITE_API_PROD_PRIMARY || "",
    backup: import.meta.env.VITE_API_PROD_BACKUP || ""
  },
  
  // Waktu tunggu sebelum pindah server (ms)
  timeout: 10000
};

// Helper untuk ambil URL berdasarkan environment saat ini
export const getBaseUrls = () => {
  return isDevelopment ? API_CONFIG.development : API_CONFIG.production;
};
