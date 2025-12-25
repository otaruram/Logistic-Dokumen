import { useState } from 'react';
import { FileDown, Upload, X, ArrowLeft, Combine, Scissors, Image, Lock, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface PdfTabProps {
  onBack: () => void;
}

type ToolType = 'compress' | 'merge' | 'split' | 'to-images' | 'unlock' | 'watermark' | null;

const TOOLS = [
  { id: 'compress' as const, name: 'Compress', icon: FileDown, description: 'Reduce PDF size' },
  { id: 'merge' as const, name: 'Merge', icon: Combine, description: 'Images to PDF (2-4)' },
  { id: 'split' as const, name: 'Split', icon: Scissors, description: 'Extract pages' },
  { id: 'to-images' as const, name: 'PDF to IMG', icon: Image, description: 'Convert to JPG' },
  { id: 'unlock' as const, name: 'Unlock', icon: Lock, description: 'Remove password' },
  { id: 'watermark' as const, name: 'Watermark', icon: FileSignature, description: 'Add text overlay' },
];

export default function PdfTab({ onBack }: PdfTabProps) {
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const [startPage, setStartPage] = useState('1');
  const [endPage, setEndPage] = useState('5');
  const [password, setPassword] = useState('');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');

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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Merge accepts images (JPG/PNG), others accept PDF
      const acceptedTypes = activeTool === 'merge' 
        ? ['image/jpeg', 'image/jpg', 'image/png']
        : ['application/pdf'];
      
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
        acceptedTypes.includes(f.type)
      );
      
      if (droppedFiles.length !== e.dataTransfer.files.length) {
        const fileType = activeTool === 'merge' ? 'JPG/PNG images' : 'PDF files';
        toast.error(`Only ${fileType} are supported`);
      }
      
      // Validate file size
      const maxSize = activeTool === 'merge' ? 5 * 1024 * 1024 : MAX_FILE_SIZE; // 5MB for images
      const oversized = droppedFiles.filter(f => f.size > maxSize);
      if (oversized.length > 0) {
        const limit = activeTool === 'merge' ? '5MB' : '10MB';
        toast.error(`${oversized.length} file(s) exceed ${limit} limit`);
        return;
      }
      
      if (activeTool === 'merge') {
        const newFiles = [...files, ...droppedFiles];
        if (newFiles.length > 4) {
          toast.error('Maximum 4 images allowed');
          setFiles(newFiles.slice(0, 4));
        } else {
          setFiles(newFiles);
        }
      } else {
        setFiles(droppedFiles.slice(0, 1));
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const acceptedTypes = activeTool === 'merge' 
        ? ['image/jpeg', 'image/jpg', 'image/png']
        : ['application/pdf'];
      
      const selectedFiles = Array.from(e.target.files).filter(f => 
        acceptedTypes.includes(f.type)
      );
      
      const maxSize = activeTool === 'merge' ? 5 * 1024 * 1024 : MAX_FILE_SIZE;
      const oversized = selectedFiles.filter(f => f.size > maxSize);
      if (oversized.length > 0) {
        const limit = activeTool === 'merge' ? '5MB' : '10MB';
        toast.error(`${oversized.length} file(s) exceed ${limit} limit`);
        return;
      }
      
      if (activeTool === 'merge') {
        const newFiles = [...files, ...selectedFiles];
        if (newFiles.length > 4) {
          toast.error('Maximum 4 images allowed');
          setFiles(newFiles.slice(0, 4));
        } else {
          setFiles(newFiles);
        }
      } else {
        setFiles(selectedFiles.slice(0, 1));
      }
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      toast.error('Please select a file');
      return;
    }

    // Merge validation
    if (activeTool === 'merge' && files.length < 2) {
      toast.error('Please select at least 2 images');
      return;
    }

    if (activeTool === 'merge' && files.length > 4) {
      toast.error('Maximum 4 images allowed');
      return;
    }

    setIsProcessing(true);
    const loadingToast = toast.loading('Processing...');

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.dismiss(loadingToast);
        toast.error('Please login first');
        return;
      }

      const formData = new FormData();
      let endpoint = '';
      
      switch (activeTool) {
        case 'compress':
          formData.append('file', files[0]);
          endpoint = '/api/tools/compress-pdf';
          break;
          
        case 'merge':
          files.forEach(file => formData.append('files', file));
          endpoint = '/api/tools/pdf/merge-images';
          break;
          
        case 'split':
          formData.append('file', files[0]);
          formData.append('start_page', startPage);
          formData.append('end_page', endPage);
          endpoint = '/api/tools/pdf/split';
          break;
          
        case 'to-images':
          formData.append('file', files[0]);
          formData.append('max_pages', '20');
          endpoint = '/api/tools/pdf/to-images';
          break;
          
        case 'unlock':
          if (!password) {
            toast.dismiss(loadingToast);
            toast.error('Please enter password');
            return;
          }
          formData.append('file', files[0]);
          formData.append('password', password);
          endpoint = '/api/tools/pdf/unlock';
          break;
          
        case 'watermark':
          formData.append('file', files[0]);
          formData.append('watermark_text', watermarkText);
          endpoint = '/api/tools/pdf/watermark';
          break;
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Processing failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const ext = activeTool === 'to-images' ? 'zip' : 'pdf';
      a.download = `${activeTool}-${Date.now()}.${ext}`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.dismiss(loadingToast);
      toast.success('Done! File downloaded');
      
      setFiles([]);
      setPassword('');
      if (document.getElementById('pdf-upload')) {
        (document.getElementById('pdf-upload') as HTMLInputElement).value = '';
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Error processing PDF');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  if (!activeTool) {
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-medium hover:text-gray-600 mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div>
              <h1 className="text-2xl font-bold">pdf.wtf</h1>
              <p className="text-sm text-gray-600">Professional PDF tools</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className="border border-gray-300 p-6 bg-white hover:bg-black hover:text-white transition-all text-center group"
                >
                  <Icon className="w-10 h-10 mx-auto mb-3 stroke-[1.5]" />
                  <h3 className="font-bold text-base mb-1">{tool.name}</h3>
                  <p className="text-xs text-gray-500 group-hover:text-gray-300">{tool.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const toolName = TOOLS.find(t => t.id === activeTool)?.name || '';
  
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button
            onClick={() => {
              setActiveTool(null);
              setFiles([]);
              setPassword('');
            }}
            className="flex items-center gap-2 text-sm font-medium hover:text-gray-600 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tools
          </button>

          <div>
            <h1 className="text-2xl font-bold">{toolName.toLowerCase()}.wtf</h1>
            <p className="text-sm text-gray-600">
              {TOOLS.find(t => t.id === activeTool)?.description}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="border border-gray-300 p-6 bg-gray-50">
          {files.length === 0 ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed ${
                dragActive ? 'border-black bg-white' : 'border-gray-400'
              } p-16 text-center transition-colors cursor-pointer hover:border-black hover:bg-white`}
              onClick={() => document.getElementById('pdf-upload')?.click()}
            >
              <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400 stroke-[1.5]" />
              <p className="text-lg font-medium mb-2">
                {activeTool === 'merge' ? 'Drop 2-4 images here' : 'Drop PDF file here'}
              </p>
              <p className="text-sm text-gray-500 mb-4">or click to select</p>
              <div className="inline-block px-4 py-2 bg-white border border-gray-300 text-sm">
                {activeTool === 'merge' ? 'JPG/PNG • Max 5MB each' : 'PDF • Max 10MB'}
              </div>
              <input
                id="pdf-upload"
                type="file"
                accept={activeTool === 'merge' ? 'image/jpeg,image/jpg,image/png' : '.pdf,application/pdf'}
                multiple={activeTool === 'merge'}
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-gray-300 p-4">
                <p className="text-sm font-bold mb-3">
                  {activeTool === 'merge' ? `${files.length} file(s) selected` : 'File selected'}
                </p>
                {files.map((file, index) => (
                  <div key={index} className="flex items-start justify-between py-2 border-t first:border-t-0">
                    <div className="flex-1">
                      <p className="font-medium text-sm break-all">{file.name}</p>
                      <p className="text-xs text-gray-600">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      onClick={() => setFiles(files.filter((_, i) => i !== index))}
                      className="ml-4 p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              {activeTool === 'split' && (
                <div className="bg-white border border-gray-300 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startPage" className="text-sm">Start Page</Label>
                      <Input
                        id="startPage"
                        type="number"
                        value={startPage}
                        onChange={(e) => setStartPage(e.target.value)}
                        min="1"
                        className="border-gray-300 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="endPage" className="text-sm">End Page</Label>
                      <Input
                        id="endPage"
                        type="number"
                        value={endPage}
                        onChange={(e) => setEndPage(e.target.value)}
                        min="1"
                        className="border-gray-300 mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTool === 'unlock' && (
                <div className="bg-white border border-gray-300 p-4">
                  <Label htmlFor="password" className="text-sm">Enter Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="border-gray-300 mt-1"
                  />
                </div>
              )}

              {activeTool === 'watermark' && (
                <div className="bg-white border border-gray-300 p-4">
                  <Label htmlFor="watermark" className="text-sm">Watermark Text</Label>
                  <Input
                    id="watermark"
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="CONFIDENTIAL"
                    className="border-gray-300 mt-1"
                  />
                </div>
              )}

              <Button
                onClick={handleProcess}
                disabled={isProcessing}
                className="w-full bg-black hover:bg-gray-800 text-white font-medium py-6 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : `${toolName} & Download`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
