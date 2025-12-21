import { QRGenerator } from '@/components/tools/QRGenerator';
import { PDFCompressor } from '@/components/tools/PDFCompressor';
import { Wrench } from 'lucide-react';

export default function ToolsTab() {
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b-2 border-black px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-black text-white">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">GA Toolkit</h1>
            <p className="text-sm text-gray-600">
              Tools praktis untuk mempercepat kerja GA sehari-hari
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* QR Generator */}
            <div>
              <QRGenerator />
            </div>

            {/* PDF Compressor */}
            <div>
              <PDFCompressor />
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-8 border-2 border-gray-300 bg-white p-6">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span>💡</span>
              <span>Tips Penggunaan</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-bold mb-2">QR Code Generator:</p>
                <ul className="space-y-1 text-gray-700 text-xs">
                  <li>• Gunakan format WiFi untuk share password ke tamu</li>
                  <li>• Cetak QR pada label aset untuk tracking inventaris</li>
                  <li>• Buat QR link SOP agar mudah diakses mobile</li>
                  <li>• QR akan otomatis terdownload sebagai PNG</li>
                </ul>
              </div>
              <div>
                <p className="font-bold mb-2">PDF Compressor:</p>
                <ul className="space-y-1 text-gray-700 text-xs">
                  <li>• Maksimal file 10MB untuk keamanan server</li>
                  <li>• Hasil terbaik untuk PDF dengan banyak gambar</li>
                  <li>• Kompres sebelum email agar tidak kena batas size</li>
                  <li>• File sudah kecil mungkin tidak banyak berkurang</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
