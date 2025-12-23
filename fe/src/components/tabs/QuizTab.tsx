import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ArrowLeft, Loader2, FileUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface QuizTabProps {
  onBack: () => void;
}

export default function QuizTab({ onBack }: QuizTabProps) {
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(20);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfContext, setPdfContext] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }

    setPdfFile(file);
    setIsExtracting(true);
    toast.loading('Extracting text from PDF...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/quiz/extract-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to extract PDF');

      const data = await response.json();
      setPdfContext(data.text);
      toast.dismiss();
      toast.success(`Extracted ${data.pages} pages from PDF`);
      
      // Auto-set topic from filename if empty
      if (!topic) {
        const filename = file.name.replace('.pdf', '').replace(/[-_]/g, ' ');
        setTopic(filename);
      }
    } catch (error) {
      console.error('PDF extraction error:', error);
      toast.dismiss();
      toast.error('Failed to extract PDF content');
      setPdfFile(null);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim() || topic.length < 3) {
      toast.error('Topic must be at least 3 characters');
      return;
    }

    if (questionCount < 1 || questionCount > 50) {
      toast.error('Number of questions must be between 1-50');
      return;
    }

    setIsGenerating(true);
    toast.loading('Generating quiz...');

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.dismiss();
        toast.error('Please login first');
        return;
      }

      const response = await fetch(`${API_URL}/api/quiz/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          topic: topic.trim(),
          num_questions: questionCount,
          pdf_context: pdfContext || null
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate quiz');
      }

      const data = await response.json();
      
      toast.dismiss();
      toast.success('Quiz generated!');
      
      const quizId = data.redirectUrl.split('/').pop();
      navigate(`/play/${quizId}`);
      
    } catch (error: any) {
      console.error('Error generating quiz:', error);
      toast.dismiss();
      toast.error(error.message || 'Failed to generate quiz');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Elegant Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-black transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black flex items-center justify-center">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">quiz.wtf</h1>
              <p className="text-sm text-gray-500">AI-powered quiz generator</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Card - Elegant Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 shadow-sm">
          
          {/* Form Header */}
          <div className="border-b border-gray-200 px-8 py-6">
            <h2 className="text-lg font-semibold mb-1">Create New Quiz</h2>
            <p className="text-sm text-gray-500">Generate questions from topic or PDF document</p>
          </div>

          {/* Form Body */}
          <div className="p-8 space-y-6">
            
            {/* Topic Input */}
            <div>
              <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
                Quiz Topic
              </label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., World History, Biology Grade 10"
                className="h-11 border-gray-300 focus:border-black focus:ring-black"
                disabled={isGenerating || isExtracting}
              />
            </div>

            {/* Question Count */}
            <div>
              <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-2">
                Number of Questions: {questionCount}
              </label>
              
              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-2 mb-3">
                {[10, 20, 30, 40, 50].map((num) => (
                  <button
                    key={num}
                    onClick={() => setQuestionCount(num)}
                    className={`px-4 py-2 text-sm font-medium border-2 transition-all ${
                      questionCount === num
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-black'
                    }`}
                    disabled={isGenerating || isExtracting}
                  >
                    {num}
                  </button>
                ))}
              </div>
              
              {/* Range Slider for Fine Control */}
              <div className="space-y-2">
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                  disabled={isGenerating || isExtracting}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1</span>
                  <span>50</span>
                </div>
              </div>
            </div>

            {/* PDF Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PDF Document (Optional)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  disabled={isGenerating || isExtracting}
                  className="hidden"
                  id="pdf-upload"
                />
                <label
                  htmlFor="pdf-upload"
                  className={`flex items-center justify-center gap-2 h-24 border-2 border-dashed border-gray-300 hover:border-black transition-colors cursor-pointer ${
                    isExtracting || isGenerating ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      <span className="text-sm text-gray-500">Extracting...</span>
                    </>
                  ) : pdfFile ? (
                    <div className="flex items-center gap-2">
                      <FileUp className="w-5 h-5 text-black" />
                      <span className="text-sm font-medium text-black">{pdfFile.name}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setPdfFile(null);
                          setPdfContext('');
                        }}
                        className="ml-2 p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <FileUp className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-500">Click to upload PDF (max 50 pages)</span>
                    </>
                  )}
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Upload a PDF to generate questions based on its content
              </p>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isExtracting || topic.length < 3}
              className="w-full h-12 bg-black hover:bg-gray-900 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Quiz...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Generate Quiz
                </>
              )}
            </Button>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-8 py-4 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              Powered by GPT-4 • Share results with friends
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
