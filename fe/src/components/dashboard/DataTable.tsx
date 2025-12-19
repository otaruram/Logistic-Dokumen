// Tambahkan fungsi ini di dalam komponen DataTable Mas
const handleExport = async () => {
    try {
        const token = localStorage.getItem('token'); // Ambil token user
        const response = await fetch(`${import.meta.env.VITE_API_URL}/export-excel`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Gagal mengunduh file");

        // Proses Respons sebagai BLOB
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Trigger Download
        const a = document.createElement("a");
        a.href = url;
        a.download = `Laporan_OCR_${new Date().toLocaleDateString()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        
        // Bersihkan Memori
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success("Excel berhasil diunduh!");
    } catch (error) {
        toast.error("Gagal mengunduh laporan. Pastikan data tidak kosong.");
    }
};
