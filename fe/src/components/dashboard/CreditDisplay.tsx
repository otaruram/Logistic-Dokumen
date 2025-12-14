import React, { useState, useEffect } from 'react';
import { Coins, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CreditInfo {
  remainingCredits: number;
  userTier: string;
  upgradeAvailable?: boolean;
}

const CreditDisplay = () => {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Fetch credits from API (fallback/initial load)
  const fetchCreditInfo = async () => {
    try {
      const userStr = sessionStorage.getItem('user');
      if (!userStr) return;
      
      const user = JSON.parse(userStr);
      const token = user.credential || user.driveToken || user.access_token;
      if (!token) return;
      
      const baseURL = import.meta.env.VITE_API_URL || 'https://api-ocr.xyz';
      const apiURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
      
      const response = await fetch(`${apiURL}/api/pricing/user/credits`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          console.log('📊 Credit API success:', data.data);
          setCreditInfo(data.data);
        }
      }
    } catch (error) {
      console.error('Credit fetch failed:', error);
    }
  };

  useEffect(() => {
    // 1. Initial Load - immediately fetch on mount
    fetchCreditInfo();

    // 2. Polling ringan (30 detik) 
    const interval = setInterval(fetchCreditInfo, 30000);

    // 3. ⚡ REALTIME LISTENER - Key part!
    const handleRealtimeUpdate = (event: any) => {
      console.log('⚡ Realtime credit update received:', event.detail);
      
      if (event.detail && typeof event.detail.remainingCredits === 'number') {
        console.log(`💳 Credit updated: ${creditInfo?.remainingCredits || '...'} → ${event.detail.remainingCredits}`);
        
        setCreditInfo(prev => ({
          ...prev,
          remainingCredits: event.detail.remainingCredits,
          userTier: prev?.userTier || 'starter'
        }));
        
        // Visual feedback
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 1000);
      } else {
        console.log('🔄 Event without data, doing manual fetch');
        setTimeout(fetchCreditInfo, 200);
      }
    };

    // Listen for real-time events
    window.addEventListener('creditUpdated', handleRealtimeUpdate);
    window.addEventListener('scanComplete', handleRealtimeUpdate);
    window.addEventListener('refreshCredits', fetchCreditInfo);

    return () => {
      clearInterval(interval);
      window.removeEventListener('creditUpdated', handleRealtimeUpdate);
      window.removeEventListener('scanComplete', handleRealtimeUpdate);
      window.removeEventListener('refreshCredits', fetchCreditInfo);
    };
  }, []); // Empty dependency array for immediate mount effect

  // Visual Logic
  const getCreditColor = () => {
    if (!creditInfo) return 'text-gray-400';
    if (creditInfo.remainingCredits <= 0) return 'text-red-600';
    if (creditInfo.remainingCredits <= 1) return 'text-orange-500';
    return 'text-green-600';
  };

  const getCreditIcon = () => {
    if (!creditInfo) {
      return <Coins className="w-4 h-4 text-gray-400 animate-pulse" />;
    }
    if (creditInfo.userTier === 'PRO') {
      return <Sparkles className="w-4 h-4 text-yellow-500" />;
    }
    return <Coins className="w-4 h-4 text-blue-500" />;
  };

  // Show loading state if credit info not loaded yet
  if (!creditInfo) {
    return (
      <Button
        variant="outline"
        className="brutal-border-thin px-3 py-2 bg-background flex items-center gap-2"
        disabled
      >
        <Coins className="w-4 h-4 text-gray-400 animate-pulse" />
        <span className="font-bold text-sm text-gray-400 tabular-nums">
          ...
        </span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`brutal-border-thin px-3 py-2 bg-background flex items-center gap-2 hover:bg-accent transition-all duration-300 ${
            isAnimating ? 'scale-110 bg-green-50 ring-2 ring-green-300' : ''
          }`}
        >
          <div className="relative">
             {getCreditIcon()}
             {isAnimating && (
               <div className="absolute -inset-1 bg-green-400 rounded-full animate-ping opacity-30"></div>
             )}
          </div>
          <span className={`font-bold text-sm ${getCreditColor()} tabular-nums transition-all duration-300`}>
            {creditInfo.remainingCredits}
          </span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64 brutal-border-thin">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Sisa Kredit</span>
          <span className={`font-mono text-lg ${getCreditColor()}`}>
            {creditInfo.remainingCredits}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3 h-3" /> 1 Scan = 1 Kredit
            </div>
            <p>Reset otomatis setiap jam 00:00</p>
            {creditInfo.remainingCredits <= 1 && (
              <p className="text-red-600 font-medium mt-1">⚠️ Kredit hampir habis!</p>
            )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CreditDisplay;