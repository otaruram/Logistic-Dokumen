import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Scan, FileText, Cloud, Zap, Shield, Download, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface LandingPageProps {
  onLogin: () => void;
}

interface Review {
  id: number;
  user_name: string;
  rating: number;
  feedback: string;
  created_at: string;
}

const LandingPage = ({ onLogin }: LandingPageProps) => {
  const [typedText, setTypedText] = useState("");
  const fullText = "Document Intelligence\nMade Simple";
  const [typedSubtitle, setTypedSubtitle] = useState("");
  const fullSubtitle = "AI-powered OCR, automated invoicing, and seamless cloud integration. Built for professionals who value simplicity and security.";
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Fetch reviews
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/reviews/recent`);
        if (response.ok) {
          const data = await response.json();
          setReviews(data);
        }
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
      }
    };
    fetchReviews();
  }, []);

  useEffect(() => {
    if (typedText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.slice(0, typedText.length + 1));
      }, 80);
      return () => clearTimeout(timeout);
    } else if (!showSubtitle) {
      setTimeout(() => setShowSubtitle(true), 200);
    }
  }, [typedText, showSubtitle]);

  useEffect(() => {
    if (showSubtitle && typedSubtitle.length < fullSubtitle.length) {
      const timeout = setTimeout(() => {
        setTypedSubtitle(fullSubtitle.slice(0, typedSubtitle.length + 1));
      }, 20);
      return () => clearTimeout(timeout);
    }
  }, [typedSubtitle, showSubtitle]);

  const features = [
    {
      icon: <Scan className="w-8 h-8" />,
      title: "OCR Technology",
      description: "Powered by Tesseract & OpenAI for accurate text extraction from any document"
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: "Invoice Generator",
      description: "Create professional invoices with 10 customizable templates"
    },
    {
      icon: <Cloud className="w-8 h-8" />,
      title: "Cloud Storage",
      description: "Secure file storage with Google Drive integration for easy sharing"
    },
    {
      icon: <Download className="w-8 h-8" />,
      title: "Export Anywhere",
      description: "Export to Excel, download, or share with auto-formatted data"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Digital Signature",
      description: "Sign documents digitally with canvas signature capture"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Lightning Fast",
      description: "Process documents in seconds with serverless architecture"
    }
  ];

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 sm:py-16 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center space-y-8 max-w-5xl mx-auto"
        >
          {/* Logo/Brand */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-block"
          >
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="bg-black p-4 rounded-xl">
                <Scan className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">
                ocr.wtf
              </h1>
            </div>
          </motion.div>

          {/* Hero Text with Typing Animation */}
          <div className="space-y-6">
            <div className="min-h-[180px] sm:min-h-[200px] lg:min-h-[240px] flex items-center justify-center">
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-black leading-tight">
                {typedText.split('\n').map((line, i) => (
                  <span key={i}>
                    {i === 0 ? line : <span className="text-gray-600">{line}</span>}
                    {i === 0 && <br />}
                  </span>
                ))}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="inline-block w-1 h-12 sm:h-14 lg:h-16 bg-black ml-1 align-middle"
                />
              </h2>
            </div>

            {/* Subtitle with Typing */}
            {showSubtitle && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="min-h-[100px] sm:min-h-[80px] flex items-center justify-center"
              >
                <p className="text-lg sm:text-xl lg:text-2xl text-gray-700 max-w-3xl mx-auto font-light">
                  {typedSubtitle}
                  {typedSubtitle.length < fullSubtitle.length && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="inline-block w-0.5 h-5 sm:h-6 bg-gray-700 ml-0.5 align-middle"
                    />
                  )}
                </p>
              </motion.div>
            )}
          </div>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="pt-8"
          >
            <Button
              size="lg"
              onClick={onLogin}
              className="text-lg px-12 py-7 bg-black text-white hover:bg-gray-800 transition-all duration-300 rounded-full font-medium"
            >
              Start
            </Button>
          </motion.div>

          {/* Trusted By Section with Blob Animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-16 w-full overflow-hidden"
          >
            <div className="relative py-8">
              {/* Animated Blob Background */}
              <motion.div
                animate={{
                  x: ["-100%", "100%"],
                }}
                transition={{
                  duration: 30,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="absolute inset-0 flex items-center gap-16 whitespace-nowrap"
                style={{ width: "200%" }}
              >
                {[...Array(2)].map((_, groupIndex) => (
                  <div key={groupIndex} className="flex items-center gap-16">
                    {[
                      "Trusted by Students",
                      "Trusted by Admins",
                      "Trusted by Pak Ujang",
                      "Trusted by Pak Asep",
                      "Trusted by Developers",
                      "Trusted by Managers",
                      "Trusted by Bu Siti",
                      "Trusted by Professionals",
                      "Trusted by Startups",
                      "Trusted by Enterprises",
                    ].map((text, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 px-6 py-3 bg-gray-100 rounded-full border border-gray-200"
                      >
                        <div className="w-2 h-2 bg-black rounded-full" />
                        <span className="text-sm font-medium text-gray-800">
                          {text}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="flex flex-wrap justify-center gap-8 pt-12 text-sm text-gray-600 border-t border-gray-200 mt-12"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Enterprise Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Instant Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              <span>Cloud Integrated</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Features Section */}
      <div className="bg-gray-50 py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-black">
              Everything You Need
            </h3>
            <p className="text-gray-600 text-lg sm:text-xl max-w-2xl mx-auto">
              Professional document management tools designed for modern workflows
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <Card className="p-8 hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-black h-full bg-white">
                  <div className="inline-flex p-4 rounded-xl bg-black text-white mb-6">
                    {feature.icon}
                  </div>
                  <h4 className="text-xl font-bold mb-3 text-black">{feature.title}</h4>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      {reviews.length > 0 && (
        <div className="bg-white py-12 sm:py-16 border-t border-gray-200">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-10"
            >
              <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-black">
                What Users Say
              </h3>
              <p className="text-gray-600 text-lg sm:text-xl max-w-2xl mx-auto">
                Real feedback from professionals using ocr.wtf
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {reviews.slice(0, 6).map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                >
                  <Card className="p-6 hover:shadow-xl transition-all duration-300 border-2 border-gray-200 h-full bg-white">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold">
                        {review.user_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-black">{review.user_name}</p>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${i < review.rating
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-gray-300"
                                }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    {review.feedback && (
                      <p className="text-gray-600 text-sm leading-relaxed">
                        "{review.feedback}"
                      </p>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="container mx-auto px-4 py-12 sm:py-16"
      >
        <Card className="bg-black text-white p-8 sm:p-10 lg:p-12 text-center border-none">
          <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Ready to Get Started?
          </h3>
          <p className="text-lg sm:text-xl text-gray-300 mb-6 max-w-2xl mx-auto">
            Join professionals who trust ocr.wtf for their document management needs
          </p>
          <Button
            size="lg"
            onClick={onLogin}
            className="bg-white text-black hover:bg-gray-100 text-lg px-12 py-7 rounded-full font-medium transition-all duration-300"
          >
            Start Now
          </Button>
        </Card>
      </motion.div>

      {/* Footer */}
      <div className="border-t border-gray-200 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          <p>© 2025 ocr.wtf. Built for professionals.</p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
