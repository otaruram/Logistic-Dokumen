import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, User as UserIcon, Calendar, Activity, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    joinDate: '',
    totalScans: 0,
    lastScan: '',
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Apply theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, []);

  useEffect(() => {
    // Get user from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUser(userData);
    }

    // Fetch user statistics initially
    fetchUserStats();

    // Auto-refresh stats every 5 seconds for real-time updates
    const interval = setInterval(() => {
      fetchUserStats();
    }, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  const fetchUserStats = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const userData = userStr ? JSON.parse(userStr) : null;
      const token = userData?.credential || userData?.driveToken || '';

      if (!token) {
        console.log('No token available');
        return;
      }

      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const API_URL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;

      const response = await fetch(`${API_URL}/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, redirect to login
          console.log('Token expired, please login again');
          toast.error('Sesi berakhir, silakan login ulang');
          localStorage.removeItem('user');
          localStorage.removeItem('isAuthenticated');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (response.ok) {
        const logs = await response.json();
        
        // Calculate stats
        const totalScans = logs.length;
        
        // Logs are ordered DESC (newest first), so:
        // - First item (logs[0]) = newest/latest scan
        // - Last item (logs[logs.length - 1]) = oldest/first scan
        const joinDate = logs.length > 0 
          ? new Date(logs[logs.length - 1].timestamp).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : 'Belum ada aktivitas';
        
        const lastScan = logs.length > 0
          ? new Date(logs[0].timestamp).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Belum ada aktivitas';

        setStats({
          joinDate,
          totalScans,
          lastScan,
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const userStr = localStorage.getItem('user');
      const userData = userStr ? JSON.parse(userStr) : null;
      const token = userData?.credential || userData?.driveToken || '';

      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const API_URL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;

      const response = await fetch(`${API_URL}/delete-account`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('Akun berhasil dihapus');
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        navigate('/landing');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Gagal menghapus akun');
      }
    } catch (error) {
      console.error('Delete account failed:', error);
      toast.error('Terjadi kesalahan saat menghapus akun');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6">
        <Button
          onClick={() => navigate('/')}
          variant="outline"
          className="brutal-border-thin px-4 py-2 font-mono text-xs font-bold flex items-center gap-2 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          KEMBALI
        </Button>
      </div>

      {/* Profile Card */}
      <div className="max-w-2xl mx-auto">
        <div className="brutal-border bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-6">
          {/* User Info */}
          <div className="flex items-center gap-4 mb-8">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-20 h-20 rounded-full brutal-border"
              />
            ) : (
              <div className="w-20 h-20 rounded-full brutal-border bg-gray-100 flex items-center justify-center">
                <UserIcon className="w-10 h-10 text-gray-400" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold mb-1">{user?.name || 'User'}</h1>
              <p className="text-sm text-muted-foreground font-mono">{user?.email}</p>
            </div>
          </div>

          {/* Statistics */}
          <div className="border-t-2 border-black pt-6 mb-6">
            <h2 className="text-lg font-bold mb-4 uppercase">Statistik Pengguna</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Join Date */}
              <div className="brutal-border-thin bg-background p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <span className="text-xs font-bold uppercase text-muted-foreground">
                    Bergabung
                  </span>
                </div>
                <p className="text-lg font-bold">{stats.joinDate}</p>
              </div>

              {/* Total Usage */}
              <div className="brutal-border-thin bg-background p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-green-500" />
                  <span className="text-xs font-bold uppercase text-muted-foreground">
                    Total Penggunaan
                  </span>
                </div>
                <p className="text-lg font-bold">{stats.totalScans} kali</p>
              </div>

              {/* Last Activity */}
              <div className="brutal-border-thin bg-background p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="w-5 h-5 text-purple-500" />
                  <span className="text-xs font-bold uppercase text-muted-foreground">
                    Aktivitas Terakhir
                  </span>
                </div>
                <p className="text-sm font-bold">{stats.lastScan}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Account Section */}
        <div className="brutal-border bg-destructive/10 p-6 shadow-[8px_8px_0px_0px_rgba(220,38,38,1)]">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-bold text-destructive mb-1">Zona Berbahaya</h3>
              <p className="text-sm text-muted-foreground">
                Menghapus akun akan menghapus semua data scan Anda secara permanen.
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="destructive"
            className="brutal-border-thin font-bold uppercase text-sm"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            HAPUS AKUN
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="brutal-border bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold uppercase">
              Konfirmasi Penghapusan
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Apakah Anda yakin ingin menghapus akun? Semua data scan Anda akan hilang permanen.
              <br />
              <br />
              <strong>Email: {user?.email}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="brutal-border-thin">
              BATAL
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="brutal-border-thin bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'MENGHAPUS...' : 'YA, HAPUS AKUN'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
