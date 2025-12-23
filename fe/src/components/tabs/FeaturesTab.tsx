import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Scan, FileText, Upload, Camera, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FeaturesTab = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      toast.success("File berhasil dipilih!");
    } else {
      toast.error("Hanya file gambar yang didukung");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast.success("File berhasil dipilih!");
    }
  };

  const handleScan = () => {
    if (selectedFile) {
      toast.success("Memproses OCR...");
      // Simulate processing
      setTimeout(() => {
        toast.success("OCR selesai! Hasil siap diunduh.");
        setSelectedFile(null);
      }, 2000);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-xl font-semibold">Features</h2>
        <p className="text-muted-foreground text-sm mt-1">Pilih tool yang ingin kamu gunakan</p>
      </motion.div>

      {/* OCR Feature Card */}
      <motion.div
        className="feature-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Scan className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">dgtnz.wtf</h3>
            <p className="text-xs text-muted-foreground">Ekstrak teks dari gambar</p>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
            isDragOver 
              ? "border-primary bg-primary/10" 
              : selectedFile 
                ? "border-success bg-success/10" 
                : "border-border hover:border-primary/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {selectedFile ? (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 text-success" />
              </div>
              <p className="text-sm font-medium truncate max-w-[200px] mx-auto">{selectedFile.name}</p>
              <Button onClick={handleScan} className="rounded-xl">
                Scan Sekarang
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Drop gambar di sini</p>
                <p className="text-xs text-muted-foreground mt-1">atau</p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl"
                  onClick={() => toast.info("Fitur kamera segera hadir!")}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Kamera
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Invoice Feature Card */}
      <motion.div
        className="feature-card cursor-pointer group"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={() => toast.info("Fitur audit.wtf segera hadir!")}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center">
              <FileText className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold">audit.wtf</h3>
              <p className="text-xs text-muted-foreground">Deteksi fraud invoice dengan AI</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          {["Minimalist", "Executive", "Modern", "Compact"].map((template) => (
            <span
              key={template}
              className="text-xs px-2 py-1 bg-secondary rounded-lg text-muted-foreground"
            >
              {template}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default FeaturesTab;
