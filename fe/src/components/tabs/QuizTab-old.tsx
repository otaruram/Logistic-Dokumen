import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (!topic.trim() || topic.length < 3) {
      toast.error('Topic harus minimal 3 karakter');
      return;
    }

    if (questionCount < 5 || questionCount > 50) {
      toast.error('Jumlah soal harus antara 5-50');
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
          num_questions: questionCount 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate quiz');
      }

      const data = await response.json();
      
      toast.dismiss();
      toast.success('✅ Kuis berhasil dibuat!');
      
      // Redirect to play page using React Router
      const quizId = data.redirectUrl.split('/').pop();
      navigate(`/play/${quizId}`);
      
    } catch (error: any) {
      console.error('Error generating quiz:', error);
      toast.dismiss();
      toast.error(`❌ ${error.message || 'Gagal generate kuis'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isGenerating) {
      handleGenerate();
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-black px-4 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium hover:opacity-70 mb-2 sm:mb-3 transition-opacity"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Back
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-black text-white">
              <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">quiz.wtf</h1>
              <p className="text-xs sm:text-sm text-gray-500">
                AI-powered quiz generator
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-4 py-12">
        <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
          
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-purple-100 border-2 border-purple-600 px-4 py-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-bold text-purple-900">
                Powered by GPT-4
              </span>
            </div>
            <h2 className="text-3xl font-bold mb-3">
              Belajar Jadi Lebih Seru dengan AI
            </h2>
            <p className="text-gray-600">
              Masukkan topik apapun, AI akan membuat 20 pertanyaan kuis berkualitas tinggi untukmu
            </p>
          </div>

          {/* Input Section */}
          <div className="mb-6">
            <label htmlFor="topic" className="block text-sm font-bold mb-2">
              Topik Kuis
            </label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Contoh: Sejarah Indonesia, Biologi SMA, JavaScript ES6"
              className="border-2 border-black focus:ring-2 focus:ring-purple-600 focus:border-purple-600 text-base h-14"
              maxLength={100}
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-2">
              {topic.length} / 100 karakter
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || topic.length < 3}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-6 text-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                AI Sedang Bekerja...
              </>
            ) : (
              <>
                <Brain className="w-5 h-5 mr-2" />
                Generate Kuis dengan AI
              </>
            )}
          </Button>

          {/* Features */}
          <div className="mt-8 pt-8 border-t-2 border-gray-200">
            <p className="text-sm font-bold mb-3">✨ Fitur Quiz.wtf:</p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">•</span>
                <span>20 pertanyaan berkualitas tinggi dibuat oleh GPT-4</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">•</span>
                <span>Penjelasan mendalam untuk setiap jawaban</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">•</span>
                <span>Feedback langsung saat menjawab</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">•</span>
                <span>Tingkat kesulitan progresif (mudah → sulit)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">•</span>
                <span>Cocok untuk belajar, persiapan ujian, atau hiburan edukatif</span>
              </li>
            </ul>
          </div>

          {/* Examples */}
          <div className="mt-8 pt-8 border-t-2 border-gray-200">
            <p className="text-sm font-bold mb-3">💡 Contoh Topik Populer:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Sejarah Indonesia',
                'Matematika SMA',
                'Bahasa Inggris TOEFL',
                'Programming Python',
                'Pengetahuan Umum',
                'Biologi Sel'
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setTopic(example)}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-gray-100 border-2 border-gray-300 hover:border-purple-600 hover:bg-purple-50 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
