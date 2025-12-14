import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Scan, 
  MessageSquare, 
  Calendar, 
  TrendingDown, 
  Zap, 
  CreditCard,
  Clock,
  Activity,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { apiFetch } from '@/lib/api-config';

interface CreditUsage {
  id: string;
  feature: 'ocr_scan' | 'chatbot_oki';
  creditsUsed: number;
  timestamp: string;
  details?: string;
  documentId?: string;
}

interface CreditUsageCardProps {
  onViewAll?: () => void;
  onUpgrade?: () => void;
}

const CreditUsageCard = ({ onViewAll, onUpgrade }: CreditUsageCardProps) => {
  const [usageData, setUsageData] = useState<CreditUsage[]>([]);
  const [totalCreditsUsed, setTotalCreditsUsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsageData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await apiFetch('/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Convert history data to usage format
        const usageEntries: CreditUsage[] = data.data?.slice(0, 10).map((item: any, index: number) => ({
          id: item.id || index.toString(),
          feature: 'ocr_scan',
          creditsUsed: 1,
          timestamp: item.timestamp || new Date().toISOString(),
          details: `Document: ${item.kategori || 'Unknown'} - ${item.nomorDokumen || 'N/A'}`,
          documentId: item.id
        })) || [];

        setUsageData(usageEntries);
        setTotalCreditsUsed(usageEntries.length);
      }
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
    
    // Update usage data setiap 30 detik
    const interval = setInterval(fetchUsageData, 30000);
    
    // Listen untuk event usage update
    const handleUsageUpdate = () => {
      fetchUsageData();
    };
    
    window.addEventListener('creditUsed', handleUsageUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('creditUsed', handleUsageUpdate);
    };
  }, []);

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'ocr_scan':
        return <Scan className="w-4 h-4 text-blue-500" />;
      case 'chatbot_oki':
        return <MessageSquare className="w-4 h-4 text-green-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getFeatureName = (feature: string) => {
    switch (feature) {
      case 'ocr_scan':
        return 'OCR Scan';
      case 'chatbot_oki':
        return 'OKi Chatbot';
      default:
        return 'Unknown';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'dd MMM HH:mm', { locale: id });
    } catch {
      return 'Unknown time';
    }
  };

  if (isLoading) {
    return (
      <Card className="brutal-border h-[400px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            <span>Credit Usage</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex-1">
                  <div className="w-24 h-4 bg-gray-200 rounded animate-pulse mb-1"></div>
                  <div className="w-32 h-3 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="brutal-border h-[400px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            <span>Credit Usage</span>
          </CardTitle>
          <Badge variant="outline" className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3" />
            {totalCreditsUsed} used
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="text-center p-3 bg-blue-50 rounded-md border">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Scan className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">OCR Scans</span>
            </div>
            <div className="text-lg font-bold text-blue-600">
              {usageData.filter(item => item.feature === 'ocr_scan').length}
            </div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-md border">
            <div className="flex items-center justify-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">Chatbot</span>
            </div>
            <div className="text-lg font-bold text-green-600">
              {usageData.filter(item => item.feature === 'chatbot_oki').length}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-2">
            {usageData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No usage yet</p>
                <p className="text-xs text-gray-400">Start using OCR or chatbot features</p>
              </div>
            ) : (
              usageData.map((usage) => (
                <div
                  key={usage.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all"
                >
                  <div className="flex-shrink-0">
                    {getFeatureIcon(usage.feature)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {getFeatureName(usage.feature)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        -{usage.creditsUsed} credit
                      </Badge>
                    </div>
                    
                    {usage.details && (
                      <p className="text-xs text-gray-600 truncate mt-1">
                        {usage.details}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(usage.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="flex gap-2 mt-4 pt-4 border-t">
          {onViewAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewAll}
              className="flex-1 flex items-center gap-2"
            >
              View All Usage
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
          
          {onUpgrade && totalCreditsUsed > 5 && (
            <Button
              size="sm"
              onClick={onUpgrade}
              className="flex-1 flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="w-4 h-4" />
              Upgrade
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CreditUsageCard;