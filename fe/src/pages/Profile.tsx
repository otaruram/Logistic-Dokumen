import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, User as UserIcon, AlertTriangle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiFetch } from '@/lib/api-service';
import RatingDialog from '@/components/dashboard/RatingDialog'; // Import Komponen Baru

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const userStr = sessionStorage.getItem('user');
    if (userStr) setUser(JSON.parse(userStr));
  }, []);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const userStr = sessionStorage.getItem('user');
      const token = userStr ? JSON.parse(userStr).credential : '';
      const response = await apiFetch('/delete-account', {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Akun dihapus.');
        sessionStorage.clear(); localStorage.clear();
        navigate('/landing');
      } else { toast.error('Gagal menghapus akun'); }
    } catch { toast.error('Koneksi error'); }
    finally { setIsDeleting(false); setShowDeleteDialog(false); }
  };

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center">
      <div className="w-full max-w-lg mb-6 flex justify-start">
        <Button onClick={() => navigate('/')} variant="outline" className="brutal-border-thin px-4 py-2 font-mono text-xs font-bold gap-2 hover:bg-yellow-200">
          <ArrowLeft className="w-4 h-4" /> KEMBALI
        </Button>
      </div>

      <div className="w-full max-w-lg space-y-6">
        
        {/* Identitas User */}
        <div className="brutal-border bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
          <div className="mx-auto w-24 h-24 mb-4 relative">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-full h-full rounded-full brutal-border object-cover" />
            ) : <UserIcon className="w-10 h-10 text-gray-400" />}
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight mb-1">{user?.name || 'Pengguna'}</h1>
          <p className="text-sm font-mono text-gray-500 bg-gray-100 inline-block px-2 py-1 rounded">{user?.email}</p>
        </div>

        {/* 🔥 CARD RATING BARU 🔥 */}
        <div className="brutal-border bg-blue-50 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-black flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black uppercase">Suka Aplikasinya?</h3>
            <p className="text-xs font-mono text-gray-600">Beri rating & emoji biar Oki senang!</p>
          </div>
          
          <RatingDialog 
            user={user} 
            triggerButton={
              <Button className="bg-yellow-400 text-black hover:bg-yellow-500 border-2 border-black font-bold uppercase shadow-[4px_4px_0px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
                <Star className="w-4 h-4 mr-2" /> Nilai Sekarang
              </Button>
            }
          />
        </div>

        {/* Zona Berbahaya */}
        <div className="brutal-border bg-red-50 p-6 shadow-[8px_8px_0px_0px_rgba(220,38,38,1)] border-red-600">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-black text-red-600 uppercase mb-1">Hapus Akun</h3>
              <p className="text-sm text-red-800">Menghapus akun akan menghapus seluruh data permanen.</p>
            </div>
          </div>
          <Button onClick={() => setShowDeleteDialog(true)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold uppercase border-2 border-red-900 h-12">
            <Trash2 className="w-4 h-4 mr-2" /> Hapus Akun Sekarang
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="brutal-border bg-white rounded-none border-2 border-black">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase text-red-600">Yakin Hapus?</AlertDialogTitle>
            <AlertDialogDescription>Data tidak bisa kembali.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="brutal-border-thin rounded-none font-bold">BATAL</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting} className="bg-red-600 text-white rounded-none font-bold border-2 border-black shadow-[4px_4px_0px_0px_black]">
              {isDeleting ? 'MENGHAPUS...' : 'YA, MUSNAHKAN'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
