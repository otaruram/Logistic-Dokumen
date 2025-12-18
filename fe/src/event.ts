// fe/src/utils/events.ts

// Memicu update saldo di seluruh aplikasi (Header, dll)
export const triggerCreditUpdate = () => {
  window.dispatchEvent(new CustomEvent('creditUpdated'));
};

// Memicu event penggunaan kredit (untuk analitik/log realtime jika ada)
export const triggerCreditUsage = (feature: 'ocr_scan' | 'chatbot_oki', details?: string) => {
  window.dispatchEvent(new CustomEvent('creditUsed', { 
    detail: { feature, details, timestamp: new Date().toISOString() } 
  }));
  
  // Sekalian refresh saldo
  triggerCreditUpdate();
};

// Menampilkan warning jika kredit menipis
export const showCreditWarning = (remainingCredits: number) => {
  if (remainingCredits <= 0) {
    window.dispatchEvent(new CustomEvent('creditWarning', {
      detail: { 
        message: 'Kredit Habis! Mohon topup.', 
        remainingCredits,
        severity: 'critical'
      }
    }));
  } else if (remainingCredits <= 2) {
    window.dispatchEvent(new CustomEvent('creditWarning', {
      detail: { 
        message: 'Kredit Kritis (Sisa ≤ 2)', 
        remainingCredits,
        severity: 'critical'
      }
    }));
  } else if (remainingCredits <= 5) {
    window.dispatchEvent(new CustomEvent('creditWarning', {
      detail: { 
        message: 'Kredit Menipis', 
        remainingCredits,
        severity: 'warning'
      }
    }));
  }
};
