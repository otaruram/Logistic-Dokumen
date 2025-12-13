import React, { useState, useEffect } from 'react';
import { Coins, CreditCard, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface CreditInfo {
  remainingCredits: number;
  userTier: string;
  creditsUsed?: number;
  upgradeAvailable?: boolean;
}

const CreditDisplay = () => {
  const navigate = useNavigate();
  const [creditInfo, setCreditInfo] = useState<CreditInfo>({
    remainingCredits: 10, // Default 10 credits for new users
    userTier: 'starter',
    upgradeAvailable: true
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchCreditInfo = async () => {
    try {
      const userStr = sessionStorage.getItem('user');
      if (!userStr) return;
      
      const user = JSON.parse(userStr);
      const token = user.credential || user.driveToken;
      if (!token) return;

      const response = await fetch('http://localhost:8000/api/pricing/user/credits', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCreditInfo(data.data);
        console.log('💰 Credit info updated:', data.data);
      } else {
        console.error('Failed to fetch credit info:', response.status);
      }
    } catch (error) {
      console.error('Error fetching credit info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditInfo();
    
    // Polling interval setiap 2 detik untuk update responsif  
    const interval = setInterval(() => fetchCreditInfo(), 2000);
    
    // Event listener untuk update manual dengan force refresh
    const handleCreditUpdate = () => {
      console.log('🔄 Credit update event received, force refreshing...');
      fetchCreditInfo();
    };
    
    // Listen for scan completion events
    const handleScanComplete = (event: any) => {
      if (event.detail?.creditInfo) {
        console.log('📊 Updating credits from scan response:', event.detail.creditInfo);
        setCreditInfo(event.detail.creditInfo);
      }
      fetchCreditInfo();
    };
    
    window.addEventListener('creditUpdated', handleCreditUpdate);
    window.addEventListener('scanComplete', handleScanComplete);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('creditUpdated', handleCreditUpdate);
      window.removeEventListener('scanComplete', handleScanComplete);
    };
  }, []);

  const getTierIcon = () => {
    switch (creditInfo.userTier) {
      case 'PRO':
        return <Sparkles className="w-4 h-4 text-yellow-500" />;
      default:
        return <Coins className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTierColor = () => {
    switch (creditInfo.userTier) {
      case 'PRO':
        return 'bg-gradient-to-r from-yellow-500 to-orange-500';
      default:
        return 'bg-gradient-to-r from-blue-500 to-purple-500';
    }
  };

  const getCreditColor = () => {
    if (creditInfo.remainingCredits <= 2) return 'text-red-500';
    if (creditInfo.remainingCredits <= 5) return 'text-yellow-500';
    return 'text-green-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
        <div className="w-12 h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="brutal-border-thin px-3 py-2 bg-background flex items-center gap-2 hover:bg-accent"
        >
          <div className="relative">
            {getTierIcon()}
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          <span className={`font-bold text-sm ${getCreditColor()}`}>
            {creditInfo.remainingCredits}
          </span>
          <Badge variant="secondary" className={`text-xs text-white ${getTierColor()}`}>
            {creditInfo.userTier.toUpperCase()}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-72 brutal-border-thin">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Credit Balance</span>
          <div className="flex items-center gap-2">
            {getTierIcon()}
            <span className="text-sm font-normal">{creditInfo.userTier.toUpperCase()}</span>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Remaining Credits</span>
            <span className={`font-bold text-lg ${getCreditColor()}`}>
              {creditInfo.remainingCredits}
            </span>
          </div>
          
          {creditInfo.remainingCredits <= 5 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-600" />
                <span className="text-xs text-yellow-700">
                  {creditInfo.remainingCredits <= 2 ? 'Critical: Almost out of credits!' : 'Low credits remaining'}
                </span>
              </div>
            </div>
          )}
          
          <div className="text-xs text-muted-foreground mb-3">
            <div>• OCR Scan: 1 credit</div>
            
            {creditInfo.userTier === 'starter' && (
              <div>• Pro features: Unlimited</div>
            )}
          </div>
        </div>
        
        <DropdownMenuSeparator />
        
        {(creditInfo.upgradeAvailable || creditInfo.remainingCredits <= 5) && (
          <DropdownMenuItem 
            onClick={() => navigate('/cek-this-out?tab=pricing')}
            className="flex items-center gap-2 text-blue-600"
          >
            <Sparkles className="w-4 h-4" />
            <span>Upgrade Plan</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CreditDisplay;