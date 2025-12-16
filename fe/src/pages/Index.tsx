  // ... (kode import dll tetap sama)

  const loadData = useCallback(async () => {
    try {
      const token = user?.credential || "";
      if (!token) return;

      // 1. Load History Log
      const response = await apiFetch('/history', { 
        headers: { "Authorization": `Bearer ${token}` } 
      });
      const data = await response.json();
      
      if (Array.isArray(data)) {
        // ... (formatting log tetap sama) ...
        const formattedLogs = data.map((log: any) => ({
           // ... mapping log ...
           id: log.id,
           time: new Date(log.timestamp).toLocaleTimeString(),
           date: new Date(log.timestamp).toISOString().split('T')[0],
           docType: log.kategori,
           docNumber: log.nomorDokumen,
           receiver: log.receiver,
           imageUrl: log.imagePath, // Pastikan ini terambil
           summary: log.summary,
           status: "SUCCESS"
        }));
        setLogs(formattedLogs as any);
      }

      // 2. 🔥 LOAD KREDIT TERBARU (FIX KREDIT 0) 🔥
      // Kita panggil endpoint pricing untuk memastikan saldo sync
      const creditRes = await apiFetch('/api/pricing/user/credits', {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const creditData = await creditRes.json();
      
      if (creditData.status === 'success') {
         const latestCredit = creditData.data.remainingCredits;
         // Update state user jika beda
         if (latestCredit !== user.creditBalance) {
            const updatedUser = { ...user, creditBalance: latestCredit };
            setUser(updatedUser);
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
         }
      }

    } catch (error) {
      console.error("Error loading data:", error);
    }
  }, [user?.credential]); // user.credential sebagai dependency
