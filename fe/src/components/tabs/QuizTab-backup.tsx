import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ArrowLeft, Loader2 } from 'lucide-react';
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
      toast.error('Topic must be at least 3 characters');
      return;
    }

    if (questionCount < 5 || questionCount > 50) {
      toast.error('Number of questions must be between 5-50');
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
      toast.success('Quiz generated successfully!');
      
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
      <div className="max-w-2xl mx-auto p-4 sm:p-6 py-8 sm:py-12">
        <div className="bg-white border border-black p-6 sm:p-8">
          
          {/* Hero Section */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3">
              Generate Quiz with AI
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Enter any topic and get high-quality questions instantly
            </p>
          </div>

          {/* Input Section */}
          <div className="space-y-4 sm:space-y-5 mb-6">
            <div>
              <label htmlFor="topic" className="block text-sm font-medium mb-2">
                Topic
              </label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="e.g., Indonesian History, High School Biology"
                className="border border-black focus:ring-1 focus:ring-black text-sm sm:text-base h-11 sm:h-12"
                maxLength={100}
                disabled={isGenerating}
              />
            </div>
            
            <div>
              <label htmlFor="count" className="block text-sm font-medium mb-2">
                Number of Questions (5-50, default: 20)
              </label>
              <Input
                id="count"
                type="number"
                min={5}
                max={50}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.min(50, Math.max(5, parseInt(e.target.value) || 20)))}
                className="border border-black focus:ring-1 focus:ring-black text-sm sm:text-base h-11 sm:h-12 w-32"
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || topic.length < 3}
            className="w-full bg-black hover:bg-gray-800 text-white font-medium py-5 sm:py-6 text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Generate Quiz
              </>
            )}
          </Button>

          {/* Quick Examples */}
          <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-200">
            <p className="text-xs sm:text-sm font-medium mb-3">Quick start:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'World History',
                'Math Grade 10',
                'English Grammar',
                'Python Programming'
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setTopic(example)}
                  disabled={isGenerating}
                  className="px-3 py-1.5 text-xs sm:text-sm border border-black hover:bg-black hover:text-white transition-colors disabled:opacity-50"
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
