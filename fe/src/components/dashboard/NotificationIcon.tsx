import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Calendar, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface NotificationIconProps {
  className?: string;
}

interface NotificationData {
  type: 'warning' | 'info';
  title: string;
  message: string;
  daysRemaining: number;
  cleanupDate: string;
  hasUnread: boolean;
}

const NotificationIcon: React.FC<NotificationIconProps> = ({ className = '' }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Key untuk LocalStorage agar unik per user
  const getStorageKey = () => {
    const userStr = sessionStorage.getItem('user');
    const email = userStr ? JSON.parse(userStr).email : 'guest';
    return `last_cleanup_notif_${email}`;
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const userStr = sessionStorage.getItem('user');
        if (!userStr) {
          setIsLoading(false);
          return; // Silent fail jika belum login
        }
        
        const user = JSON.parse(userStr);
        const token = user.credential || user.driveToken || user.access_token;
        
        if (!token) {
          setIsLoading(false);
          return;
        }

        const baseURL = import.meta.env.VITE_API_URL || window.location.origin;
        const apiURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
        
        const profileResponse = await fetch(`${apiURL}/api/pricing/user/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          
          if (profileData.status === 'success') {
            const cleanup = profileData.data.cleanup_info;
            
            // --- LOGIKA BARU: NOTIFIKASI HARIAN ---
            const todayStr = new Date().toISOString().split('T')[0];
            const lastSeenDate = localStorage.getItem(getStorageKey());
            
            // Unread TRUE jika tanggal terakhir lihat bukan hari ini
            const isUnreadToday = lastSeenDate !== todayStr;
            
            // Tentukan status urgent (misal H-7 warnanya merah/warning, selebihnya info)
            const isUrgent = cleanup.days_until_cleanup <= 7;

            const notification: NotificationData = {
              type: isUrgent ? 'warning' : 'info',
              title: isUrgent ? '⚠️ Peringatan Reset Data' : '📅 Pengingat Harian',
              message: `Data akan direset otomatis pada tanggal ${cleanup.next_cleanup_date}. Tersisa ${cleanup.days_until_cleanup} hari lagi.`,
              daysRemaining: cleanup.days_until_cleanup,
              cleanupDate: cleanup.next_cleanup_date,
              hasUnread: isUnreadToday // Selalu true jika belum diklik hari ini
            };
            
            setNotifications([notification]);
            setHasUnreadNotifications(isUnreadToday);
            setError(null);
          } else {
            console.error('Failed to load profile data structure');
          }
        } else {
          // Silent error handling agar UI tidak rusak
          console.error(`Server error: ${profileResponse.status}`);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
        // Fallback data jika server error, agar UI tetap jalan
        const mockNotification: NotificationData = {
          type: 'info',
          title: '📅 Sistem Reset Data',
          message: 'Gagal memuat detail tanggal. Pastikan Anda membackup data secara berkala.',
          daysRemaining: 30,
          cleanupDate: '-',
          hasUnread: false
        };
        setNotifications([mockNotification]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
    // Refresh tiap 5 menit
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = () => {
    // Saat user mengklik lonceng, kita anggap sudah membaca notif hari ini
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem(getStorageKey(), todayStr);

    setHasUnreadNotifications(false);
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, hasUnread: false }))
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open) markAsRead(); // Tandai sudah dibaca saat dibuka
    }}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
        >
          <Bell className={`h-5 w-5 ${hasUnreadNotifications ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`} />
          {hasUnreadNotifications && (
            <Badge 
              variant="destructive" 
              className="absolute top-1 right-1 h-2.5 w-2.5 p-0 rounded-full border-2 border-white dark:border-gray-950 animate-pulse"
            >
              <span className="sr-only">New Notifications</span>
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0 shadow-xl" align="end">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
            📢 Notifikasi
            {hasUnreadNotifications && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Baru</span>}
          </h3>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-2"/>
              <p className="text-xs">Memuat...</p>
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {notifications.map((notification, index) => (
                <div key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className={`flex gap-3`}>
                    <div className={`mt-0.5 p-2 rounded-full flex-shrink-0 ${
                      notification.type === 'warning' 
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' 
                        : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {notification.type === 'warning' ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        {notification.message}
                      </p>
                      <div className="pt-2 flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                         <Calendar className="h-3 w-3" />
                         Reset: {notification.cleanupDate}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="p-8 text-center text-gray-400">
                <p className="text-sm">Tidak ada notifikasi baru</p>
             </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationIcon;