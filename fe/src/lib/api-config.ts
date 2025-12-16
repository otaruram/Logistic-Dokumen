// fe/src/lib/api-config.ts

// Detect environment
const isDevelopment = import.meta.env.DEV;

export const API_CONFIG = {
  // Development
  development: {
    primary: "http://localhost:8000",
    backup: "https://logistic-dokumen.onrender.com"
  },
  // Production
  production: {
    primary: "https://logistic-dokumen.onrender.com",
    backup: "https://api-ocr.xyz"
  },
  timeout: 10000
};

// Helper untuk ambil URL berdasarkan env
export const getBaseUrls = () => {
  return isDevelopment ? API_CONFIG.development : API_CONFIG.production;
};
