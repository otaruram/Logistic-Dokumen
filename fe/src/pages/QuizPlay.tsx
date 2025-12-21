import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, XCircle, Brain, Sparkles, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import jsPDF from "jspdf";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface QuizOption {
  text: string;
}

interface Question {
  id: number;
  question: string;
  options: QuizOption[];
}

interface Quiz {
  id: string;
  topic: string;
  title: string;
  questions: Question[];
}

interface SubmitResult {
  questionId: number;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

const QuizPlay = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentAnswerResult, setCurrentAnswerResult] = useState<{ isCorrect: boolean; correctAnswer: string; explanation: string } | null>(null);

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  const loadQuiz = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Anda harus login terlebih dahulu",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      const response = await fetch(`${API_URL}/api/quiz/play/${quizId}`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to load quiz");

      const data = await response.json();
      setQuiz(data);
    } catch (error) {
      console.error("Error loading quiz:", error);
      toast({
        title: "Error",
        description: "Gagal memuat kuis",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answerText: string) => {
    if (showExplanation || !quiz) return;
    const question = quiz.questions[currentQuestion];
    
    setSelectedAnswer(answerText);
    setAnswers({ ...answers, [question.id]: answerText });
    
    // Validate answer with backend immediately
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/quiz/validate/${quizId}/${question.id}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answer: answerText }),
      });

      if (!response.ok) throw new Error("Failed to validate answer");

      const result = await response.json();
      setCurrentAnswerResult(result);
      setShowExplanation(true);
    } catch (error) {
      console.error("Error validating answer:", error);
      // Fallback: just show that answer was selected
      setShowExplanation(true);
    }
  };

  const handleNext = () => {
    if (!quiz) return;
    
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setCurrentAnswerResult(null);
    } else {
      submitQuiz();
    }
  };

  const submitQuiz = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !quiz) return;

      const response = await fetch(`${API_URL}/api/quiz/submit/${quizId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(answers),
      });

      if (!response.ok) throw new Error("Failed to submit quiz");

      const result = await response.json();
      setScore(result);
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast({
        title: "Error",
        description: "Gagal mengirim jawaban",
        variant: "destructive",
      });
    }
  };

  const downloadPDF = () => {
    if (!quiz || !score) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Quiz Results Report", 20, 20);
    
    // Quiz Info
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Topic: ${quiz.topic}`, 20, 35);
    doc.text(`Title: ${quiz.title}`, 20, 42);
    doc.text(`Score: ${score.score}% (${score.correct}/${score.total} correct)`, 20, 49);
    
    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 56);
    
    // Separator
    doc.setLineWidth(0.5);
    doc.line(20, 62, 190, 62);
    
    let yPos = 72;
    
    // Questions and Answers
    quiz.questions.forEach((q, index) => {
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      // Question
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const questionText = `${index + 1}. ${q.question}`;
      const questionLines = doc.splitTextToSize(questionText, 170);
      doc.text(questionLines, 20, yPos);
      yPos += questionLines.length * 7;
      
      // User's Answer
      doc.setFont("helvetica", "normal");
      const userAnswer = answers[q.id] || "Not answered";
      doc.text(`Your answer: ${userAnswer}`, 25, yPos);
      yPos += 10;
      
      // Add spacing between questions
      yPos += 5;
    });
    
    // Save PDF
    doc.save(`quiz-results-${quiz.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`);
    
    toast({
      title: "Success",
      description: "PDF report downloaded successfully!",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <Brain className="w-16 h-16 animate-pulse mx-auto mb-4 text-black" />
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="p-8 text-center border-2 border-gray-200">
          <p className="text-gray-600">Quiz not found</p>
          <Button onClick={() => navigate("/")} className="mt-4 bg-black hover:bg-gray-800">
            Back
          </Button>
        </Card>
      </div>
    );
  }

  if (score !== null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl"
        >
          <Card className="p-8 text-center border-2 border-gray-200">
            <div className="mb-6">
              <div className="w-24 h-24 rounded-full border-4 border-black flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl font-bold text-black">{score.score}%</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
              <p className="text-gray-600">
                {score.score >= 80 ? "Excellent! 🎉" : score.score >= 60 ? "Good job! 👍" : "Keep practicing! 💪"}
              </p>
            </div>
            
            <div className="space-y-2 mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
              <p className="text-sm text-gray-600">
                <strong>Topic:</strong> {quiz?.topic}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Title:</strong> {quiz?.title}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Score:</strong> {score.correct} / {score.total} correct
              </p>
            </div>

            <div className="space-y-3">
              <Button onClick={downloadPDF} className="w-full bg-black hover:bg-gray-800">
                <Download className="w-4 h-4 mr-2" />
                Download PDF Report
              </Button>
              
              <Button onClick={() => navigate("/")} variant="outline" className="w-full border-2 border-black hover:bg-black hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];
  const isCorrect = currentAnswerResult?.isCorrect ?? false;

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-2xl mx-auto py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline" className="text-xs border-gray-300">
              <Sparkles className="w-3 h-3 mr-1" />
              GPT-4
            </Badge>
            <span className="text-sm font-medium text-gray-700">
              {currentQuestion + 1} / {quiz.questions.length}
            </span>
          </div>
          
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-black"
              initial={{ width: 0 }}
              animate={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Question */}
        <Card className="p-6 mb-4 border-2 border-gray-200">
          <h3 className="text-lg font-semibold mb-4">{question.question}</h3>
          
          <div className="space-y-3">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === option.text;
              const isCorrectOption = showExplanation && currentAnswerResult?.correctAnswer === option.text;
              const showCorrect = showExplanation && isCorrectOption;
              const showWrong = showExplanation && isSelected && !isCorrect;

              return (
                <Button
                  key={index}
                  variant={isSelected ? "default" : "outline"}
                  className={`w-full justify-start text-left h-auto py-3 px-4 border-2 ${
                    showCorrect ? "bg-green-50 border-green-500 hover:bg-green-50 text-green-900" :
                    showWrong ? "bg-red-50 border-red-500 hover:bg-red-50 text-red-900" :
                    isSelected ? "bg-black text-white border-black hover:bg-gray-800" :
                    "border-gray-300 hover:border-black hover:bg-gray-50"
                  }`}
                  onClick={() => handleAnswer(option.text)}
                  disabled={showExplanation}
                >
                  <div className="flex items-center gap-3 w-full">
                    <span className="font-semibold">{String.fromCharCode(65 + index)}.</span>
                    <span className="flex-1">{option.text}</span>
                    {showCorrect && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                    {showWrong && <XCircle className="w-5 h-5 text-red-600" />}
                  </div>
                </Button>
              );
            })}
          </div>
        </Card>

        {/* Explanation */}
        {showExplanation && currentAnswerResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={`p-4 mb-4 border-2 ${isCorrect ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
              <div className="flex items-start gap-3">
                {isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className={`font-semibold mb-2 ${isCorrect ? "text-green-800" : "text-red-800"}`}>
                    {isCorrect ? "Correct! 🎉" : "Incorrect 😔"}
                  </p>
                  <p className="text-sm text-gray-700">{currentAnswerResult.explanation}</p>
                </div>
              </div>
            </Card>

            <Button
              onClick={handleNext}
              className="w-full bg-black hover:bg-gray-800 text-white"
            >
              {currentQuestion < quiz.questions.length - 1 ? "Next Question" : "View Results"}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default QuizPlay;
