// Credit utility functions for realtime updates
export const triggerCreditUpdate = () => {
  window.dispatchEvent(new CustomEvent('creditUpdated'));
};

export const triggerCreditUsage = (feature: 'ocr_scan' | 'chatbot_oki', details?: string) => {
  window.dispatchEvent(new CustomEvent('creditUsed', { 
    detail: { feature, details, timestamp: new Date().toISOString() } 
  }));
  
  // Also trigger credit update to refresh balance
  triggerCreditUpdate();
};

export const showCreditWarning = (remainingCredits: number) => {
  if (remainingCredits <= 2) {
    window.dispatchEvent(new CustomEvent('creditWarning', {
      detail: { 
        message: 'Critical: Almost out of credits!', 
        remainingCredits,
        severity: 'critical'
      }
    }));
  } else if (remainingCredits <= 5) {
    window.dispatchEvent(new CustomEvent('creditWarning', {
      detail: { 
        message: 'Low credits remaining', 
        remainingCredits,
        severity: 'warning'
      }
    }));
  }
};