import { useState } from 'react';
import { FileDown, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function PDFCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        if (droppedFile.size > MAX_FILE_SIZE) {
          toast.error('❌ File terlalu besar! Maksimal 10MB');
          return;
        }
        setFile(droppedFile);
      } else {
        toast.error('❌ Hanya file PDF yang didukung');
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        if (selectedFile.size > MAX_FILE_SIZE) {
          toast.error('❌ File terlalu besar! Maksimal 10MB');
          return;
        }
        setFile(selectedFile);
      } else {
        toast.error('❌ Hanya file PDF yang didukung');
      }
    }
  };

  const handleCompress = async () => {
    if (!file) return;

    setIsCompressing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/tools/compress-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Gagal compress PDF');
      }

      // Download the compressed PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compressed-${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const originalSize = (file.size / 1024).toFixed(2);
      const newSize = (blob.size / 1024).toFixed(2);
      const saved = ((1 - blob.size / file.size) * 100).toFixed(1);

      toast.success(`✅ PDF berhasil dikompres! ${originalSize}KB → ${newSize}KB (hemat ${saved}%)`);
      
      // Reset file after successful compression
      setFile(null);
    } catch (error) {
      console.error('Error compressing PDF:', error);
      toast.error('❌ Gagal kompres PDF');
    } finally {
      setIsCompressing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="border-2 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-black text-white">
          <FileDown className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold">PDF Compressor</h2>
          <p className="text-sm text-gray-600">
            Kecilin ukuran PDF sebelum dikirim via email
          </p>
        </div>
      </div>

      {/* Upload Area */}
      {!file ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed ${
            dragActive ? 'border-black bg-gray-50' : 'border-gray-400'
          } p-12 text-center transition-colors cursor-pointer hover:border-black hover:bg-gray-50`}
          onClick={() => document.getElementById('pdf-upload')?.click()}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="font-bold mb-2">Drag & drop PDF di sini</p>
          <p className="text-sm text-gray-500 mb-4">atau klik untuk pilih file</p>
          <p className="text-xs text-gray-400">Maksimal 10MB</p>
          <input
            id="pdf-upload"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <div className="border-2 border-black p-4 bg-gray-50">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="font-bold text-sm break-all">{file.name}</p>
              <p className="text-xs text-gray-600 mt-1">
                Ukuran: {formatFileSize(file.size)}
              </p>
            </div>
            <button
              onClick={() => setFile(null)}
              className="ml-2 p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <Button
            onClick={handleCompress}
            disabled={isCompressing}
            className="w-full bg-black hover:bg-gray-800 text-white font-bold py-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <FileDown className="w-5 h-5 mr-2" />
            {isCompressing ? 'Compressing...' : 'Compress & Download PDF'}
          </Button>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-yellow-50 border-2 border-yellow-300 p-3 text-xs">
        <p className="font-bold mb-2">⚠️ Catatan:</p>
        <ul className="space-y-1 text-gray-700">
          <li>• Kompres mengurangi kualitas gambar dalam PDF</li>
          <li>• File yang sudah sangat kecil mungkin tidak banyak berkurang</li>
          <li>• Cocok untuk dokumen dengan banyak gambar/foto</li>
        </ul>
      </div>

      {/* Use Cases */}
      <div className="mt-6 pt-6 border-t-2 border-gray-200">
        <p className="text-xs font-bold mb-2">🎯 Cocok untuk GA:</p>
        <ul className="text-xs space-y-1 text-gray-700">
          <li>• Kecilin SK/kontrak sebelum di-email</li>
          <li>• Kompres laporan dengan banyak foto</li>
          <li>• Hemat storage Google Drive kantor</li>
          <li>• Upload lebih cepat ke sistem HRIS</li>
        </ul>
      </div>
    </div>
  );
}
