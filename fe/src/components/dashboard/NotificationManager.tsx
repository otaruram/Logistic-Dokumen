import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, Info, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface NotificationManagerProps {
  userCredits: number;
}

interface CleanupWarning {
  warning: boolean;
  days_remaining?: number;
  total_logs?: number;
  total_transactions?: number;
  message?: string;
}

interface CreditStatus {
  type: 'exhausted' | 'warning' | 'info' | 'success';
  message: string;
  title: string;
}

const NotificationManager: React.FC<NotificationManagerProps> = ({ userCredits }) => {
  const [cleanupWarning, setCleanupWarning] = useState<CleanupWarning | null>(null);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [showCleanupAlert, setShowCleanupAlert] = useState(true);
  const [showCreditAlert, setShowCreditAlert] = useState(true);

  // Check for monthly cleanup warning
  useEffect(() => {
    const checkCleanupWarning = async () => {
      try {
        const token = sessionStorage.getItem('token');
        if (!token) return;

        const response = await fetch('/api/monthly-cleanup-warning', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.data.warning) {
            setCleanupWarning(data.data);
          }
        }
      } catch (error) {
        console.error('Error checking cleanup warning:', error);
      }
    };

    checkCleanupWarning();
  }, []);

  // Check credit status
  useEffect(() => {
    const checkCreditStatus = async () => {
      try {
        const response = await fetch(`/api/credit-status/${userCredits}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success') {
            setCreditStatus(data.data);
          }
        }
      } catch (error) {
        console.error('Error checking credit status:', error);
      }
    };

    if (userCredits !== undefined) {
      checkCreditStatus();
    }
  }, [userCredits]);

  const openGoogleDrive = () => {
    window.open('https://drive.google.com', '_blank');
  };

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'exhausted': return 'destructive';
      case 'warning': return 'default';
      case 'info': return 'default';
      default: return 'default';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'exhausted': return <AlertCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Monthly Cleanup Warning */}
      {cleanupWarning?.warning && showCleanupAlert && (
        <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <Calendar className="h-4 w-4" />
          <AlertTitle className="text-orange-800 dark:text-orange-200">
            ⚠️ Peringatan Penghapusan Data
          </AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            <div className="space-y-2">
              <p>{cleanupWarning.message}</p>
              <p className="text-sm">
                Total data: {cleanupWarning.total_logs} logs, {cleanupWarning.total_transactions} transaksi
              </p>
              <div className="flex gap-2 mt-3">
                <Button 
                  onClick={openGoogleDrive}
                  size="sm" 
                  variant="outline"
                  className="bg-white hover:bg-gray-50 border-orange-300"
                >
                  📁 Backup ke Google Drive
                </Button>
                <Button 
                  onClick={() => setShowCleanupAlert(false)}
                  size="sm" 
                  variant="ghost"
                  className="text-orange-600 hover:text-orange-800"
                >
                  Tutup
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Credit Status Notification */}
      {creditStatus && (creditStatus.type === 'exhausted' || creditStatus.type === 'warning') && showCreditAlert && (
        <Alert 
          variant={getAlertVariant(creditStatus.type)} 
          className={`${
            creditStatus.type === 'exhausted' 
              ? 'border-red-500 bg-red-50 dark:bg-red-950' 
              : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
          }`}
        >
          {getAlertIcon(creditStatus.type)}
          <AlertTitle className={`${
            creditStatus.type === 'exhausted' 
              ? 'text-red-800 dark:text-red-200' 
              : 'text-yellow-800 dark:text-yellow-200'
          }`}>
            {creditStatus.title}
          </AlertTitle>
          <AlertDescription className={`${
            creditStatus.type === 'exhausted' 
              ? 'text-red-700 dark:text-red-300' 
              : 'text-yellow-700 dark:text-yellow-300'
          }`}>
            <div className="space-y-2">
              <p>{creditStatus.message}</p>
              {creditStatus.type === 'exhausted' && (
                <p className="text-sm font-medium">
                  🕐 Kredit akan direset secara otomatis pada tengah malam.
                </p>
              )}
              <Button 
                onClick={() => setShowCreditAlert(false)}
                size="sm" 
                variant="ghost"
                className="mt-2"
              >
                Mengerti
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default NotificationManager;