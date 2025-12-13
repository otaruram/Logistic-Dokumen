import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  Zap, 
  Crown, 
  Check,
  Star,
  TrendingUp,
  Gift,
  ArrowLeft
} from 'lucide-react';

const PricingCard = ({ 
  title, 
  price, 
  credits, 
  features, 
  isPopular = false,
  buttonText = "Choose Plan",
  onSelect 
}: {
  title: string;
  price: string;
  credits: number;
  features: string[];
  isPopular?: boolean;
  buttonText?: string;
  onSelect?: () => void;
}) => (
  <Card className={`relative ${isPopular ? 'border-blue-500 shadow-lg' : 'border-gray-200'}`}>
    {isPopular && (
      <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500">
        <Star className="w-3 h-3 mr-1" />
        Most Popular
      </Badge>
    )}
    
    <CardHeader className="text-center">
      <CardTitle className="text-xl font-bold">{title}</CardTitle>
      <div className="mt-4">
        <span className="text-3xl font-bold">{price}</span>
        <div className="text-sm text-gray-600 mt-2">
          {credits} Credits
        </div>
      </div>
    </CardHeader>
    
    <CardContent className="space-y-4">
      <div className="space-y-2">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-sm">{feature}</span>
          </div>
        ))}
      </div>
      
      <Button 
        onClick={onSelect}
        className={`w-full ${isPopular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
        variant={isPopular ? 'default' : 'outline'}
      >
        {buttonText}
      </Button>
    </CardContent>
  </Card>
);

const CekThisOut = () => {
  const navigate = useNavigate();
  
  const handleTopUpSelect = (packageId: number) => {
    // TODO: Implement payment flow
    console.log('Selected top-up package:', packageId);
  };

  const handleProSubscribe = () => {
    // TODO: Implement subscription flow
    console.log('Subscribe to PRO plan');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Back Button */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Cek This Out! 🚀</h1>
              <p className="text-gray-600 text-sm">Kelola kredit dan upgrade plan Anda</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Direct Pricing Content */}
          <div className="space-y-8">
              {/* Current Plan Status */}
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 rounded-full">
                        <Crown className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Current Plan: Starter</h3>
                        <p className="text-gray-600">10 credits remaining</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-white">
                      <Gift className="w-3 h-3 mr-1" />
                      Welcome Bonus
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Top-Up Packages */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">Credit Top-Up Packages</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <PricingCard
                    title="Starter Pack"
                    price="Rp 25,000"
                    credits={20}
                    features={[
                      "20 OCR Scans",
                      "20 Chatbot Queries",
                      "Basic Support",
                      "7 Days Validity"
                    ]}
                    onSelect={() => handleTopUpSelect(0)}
                  />
                  
                  <PricingCard
                    title="Power Pack"
                    price="Rp 50,000"
                    credits={50}
                    features={[
                      "50 OCR Scans",
                      "50 Chatbot Queries",
                      "Priority Support",
                      "30 Days Validity",
                      "Advanced OCR"
                    ]}
                    isPopular={true}
                    onSelect={() => handleTopUpSelect(1)}
                  />
                  
                  <PricingCard
                    title="Mega Pack"
                    price="Rp 90,000"
                    credits={100}
                    features={[
                      "100 OCR Scans",
                      "100 Chatbot Queries",
                      "Premium Support",
                      "60 Days Validity",
                      "Advanced OCR",
                      "Bulk Processing"
                    ]}
                    onSelect={() => handleTopUpSelect(2)}
                  />
                </div>
              </div>

              {/* Pro Subscription */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">Pro Subscription</h2>
                <div className="max-w-md mx-auto">
                  <PricingCard
                    title="PRO Plan"
                    price="Rp 150,000/bulan"
                    credits={200}
                    features={[
                      "200 Credits/month",
                      "Unlimited Basic Features", 
                      "Premium OCR Engine",
                      "Advanced AI Summarization",
                      "Priority Support",
                      "Export to Google Drive",
                      "Advanced Analytics",
                      "API Access",
                      "No Expiry on Credits"
                    ]}
                    buttonText="Subscribe to PRO"
                    onSelect={handleProSubscribe}
                  />
                </div>
              </div>

              {/* Features Comparison */}
              <div className="mt-12">
                <h2 className="text-2xl font-bold mb-6 text-center">Feature Comparison</h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-4 font-semibold">Feature</th>
                            <th className="text-center p-4 font-semibold">Starter</th>
                            <th className="text-center p-4 font-semibold">Top-Up</th>
                            <th className="text-center p-4 font-semibold">PRO</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t">
                            <td className="p-4">OCR Scanning</td>
                            <td className="text-center p-4">✓</td>
                            <td className="text-center p-4">✓</td>
                            <td className="text-center p-4">✓</td>
                          </tr>
                          <tr className="border-t bg-gray-50">
                            <td className="p-4">AI Chatbot</td>
                            <td className="text-center p-4">✓</td>
                            <td className="text-center p-4">✓</td>
                            <td className="text-center p-4">✓</td>
                          </tr>
                          <tr className="border-t">
                            <td className="p-4">Advanced OCR</td>
                            <td className="text-center p-4">-</td>
                            <td className="text-center p-4">Limited</td>
                            <td className="text-center p-4">✓</td>
                          </tr>
                          <tr className="border-t bg-gray-50">
                            <td className="p-4">Google Drive Export</td>
                            <td className="text-center p-4">-</td>
                            <td className="text-center p-4">-</td>
                            <td className="text-center p-4">✓</td>
                          </tr>
                          <tr className="border-t">
                            <td className="p-4">API Access</td>
                            <td className="text-center p-4">-</td>
                            <td className="text-center p-4">-</td>
                            <td className="text-center p-4">✓</td>
                          </tr>
                          <tr className="border-t bg-gray-50">
                            <td className="p-4">Priority Support</td>
                            <td className="text-center p-4">-</td>
                            <td className="text-center p-4">Limited</td>
                            <td className="text-center p-4">✓</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CekThisOut;