import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Star, Zap, Shield, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PricingPackage {
  credits: number;
  price: number;
  name: string;
}

interface ProPlan {
  monthly_price: number;
  credits_per_month: number;
}

interface UserPlan {
  email: string;
  plan_type: string;
  credit_balance: number;
  subscription_end_date?: string;
  is_pro_active: boolean;
}

interface PricingData {
  packages: PricingPackage[];
  pro_plan: ProPlan;
  user_current_plan?: UserPlan;
}

const PricingPage: React.FC = () => {
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    try {
      const userStr = sessionStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const token = user?.credential || "";

      const response = await fetch(`${API_URL}/api/pricing`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });

      const result = await response.json();
      if (result.status === "success") {
        setPricingData(result.data);
      }
    } catch (error) {
      console.error("Failed to load pricing data:", error);
      toast.error("Gagal memuat data pricing");
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async (packageIndex: number) => {
    try {
      const userStr = sessionStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const token = user?.credential || "";

      if (!token) {
        toast.error("Silakan login terlebih dahulu");
        return;
      }

      setProcessingOrder(`topup-${packageIndex}`);

      const response = await fetch(`${API_URL}/api/topup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          package_id: packageIndex,
          payment_method: "midtrans"
        })
      });

      const result = await response.json();
      
      if (result.status === "success") {
        // TODO: Redirect ke payment gateway
        toast.success("Order berhasil dibuat! Redirecting to payment...");
        console.log("Payment URL:", result.data.payment_url);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error("Gagal membuat order top up");
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleSubscribe = async () => {
    try {
      const userStr = sessionStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const token = user?.credential || "";

      if (!token) {
        toast.error("Silakan login terlebih dahulu");
        return;
      }

      setProcessingOrder("subscription");

      const response = await fetch(`${API_URL}/api/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          plan: "PRO",
          payment_method: "midtrans"
        })
      });

      const result = await response.json();
      
      if (result.status === "success") {
        // TODO: Redirect ke payment gateway
        toast.success("Order langganan berhasil dibuat! Redirecting to payment...");
        console.log("Payment URL:", result.data.payment_url);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error("Gagal membuat order langganan");
    } finally {
      setProcessingOrder(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading pricing data...</div>
      </div>
    );
  }

  if (!pricingData) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-red-500">Failed to load pricing data</div>
      </div>
    );
  }

  const currentPlan = pricingData.user_current_plan;
  const isPro = currentPlan?.plan_type === "PRO" && currentPlan?.is_pro_active;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Pilih Paket yang Tepat</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Tingkatkan produktivitas scan dokumen dengan paket yang sesuai kebutuhan
        </p>
        
        {currentPlan && (
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full">
            <Badge variant={isPro ? "default" : "secondary"}>
              {currentPlan.plan_type}
            </Badge>
            <span className="text-sm">
              {currentPlan.credit_balance} Credits tersisa
            </span>
          </div>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 mb-8">
        
        {/* Starter Plan */}
        <Card className={cn(
          "relative border-2",
          !isPro && currentPlan?.plan_type === "STARTER" ? "border-primary" : "border-border"
        )}>
          <CardHeader>
            <CardTitle className="text-xl">Starter</CardTitle>
            <CardDescription>Gratis untuk memulai</CardDescription>
            <div className="text-3xl font-bold">Rp 0</div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>10 Credit Gratis</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Simpan Data Teks Selamanya</span>
              </div>
              <div className="flex items-center gap-2 text-orange-600">
                <Shield className="w-4 h-4" />
                <span>Simpan Foto Bukti 7 Hari</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <X className="w-4 h-4" />
                <span>Ekspor Excel</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              variant="outline"
              disabled={currentPlan?.plan_type === "STARTER"}
            >
              {currentPlan?.plan_type === "STARTER" ? "Paket Aktif" : "Daftar Sekarang"}
            </Button>
          </CardFooter>
        </Card>

        {/* Top Up Plans */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Top Up Credit</CardTitle>
            <CardDescription>Beli credit sesuai kebutuhan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pricingData.packages.map((pkg, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold">{pkg.name}</div>
                  <div className="text-sm text-primary">{pkg.credits} Credits</div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="font-bold">{formatPrice(pkg.price)}</div>
                  <Button 
                    size="sm"
                    onClick={() => handleTopUp(index)}
                    disabled={processingOrder === `topup-${index}`}
                  >
                    {processingOrder === `topup-${index}` ? "Processing..." : "Beli"}
                  </Button>
                </div>
              </div>
            ))}
            <div className="text-sm text-muted-foreground mt-4">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Masa Aktif 1 Tahun</span>
              </div>
              <div className="flex items-center gap-2 text-orange-600 mt-1">
                <Shield className="w-4 h-4" />
                <span>Simpan Foto Bukti 7 Hari</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pro Plan */}
        <Card className={cn(
          "relative border-2",
          isPro ? "border-primary bg-primary/5" : "border-primary/50"
        )}>
          {!isPro && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-3 py-1">
                <Star className="w-3 h-3 mr-1" />
                REKOMENDASI
              </Badge>
            </div>
          )}
          
          <CardHeader className="pt-6">
            <CardTitle className="text-xl flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Pro Business
            </CardTitle>
            <CardDescription>Untuk penggunaan profesional</CardDescription>
            <div className="space-y-1">
              <div className="text-3xl font-bold">{formatPrice(pricingData.pro_plan.monthly_price)}</div>
              <div className="text-sm text-muted-foreground">per bulan</div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="font-medium">{pricingData.pro_plan.credits_per_month} Credits / bulan</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="font-medium">Simpan Foto Bukti PERMANEN</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Prioritas Server (Tanpa Antre)</span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-green-500" />
                <span>Ekspor Laporan Excel</span>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
              <div className="text-sm font-medium text-green-800">Anti Hilang Guarantee!</div>
              <div className="text-xs text-green-700 mt-1">
                Foto bukti dokumen tersimpan permanen sebagai arsip digital yang aman
              </div>
            </div>
          </CardContent>
          
          <CardFooter>
            <Button 
              className="w-full"
              onClick={handleSubscribe}
              disabled={isPro || processingOrder === "subscription"}
            >
              {isPro 
                ? "Langganan Aktif" 
                : processingOrder === "subscription" 
                  ? "Processing..." 
                  : "Langganan Aman"
              }
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Feature Comparison Table */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-center mb-8">Perbandingan Fitur</h2>
        <div className="overflow-x-auto">
          <table className="w-full border border-border rounded-lg">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-4 border-r">Fitur</th>
                <th className="text-center p-4 border-r">Starter</th>
                <th className="text-center p-4 border-r">Top-Up</th>
                <th className="text-center p-4">Pro Business</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-4 border-r font-medium">Credit Awal</td>
                <td className="p-4 border-r text-center">10 (Sekali saja)</td>
                <td className="p-4 border-r text-center">Sesuai pembelian</td>
                <td className="p-4 text-center">200 / bulan</td>
              </tr>
              <tr className="border-t bg-muted/30">
                <td className="p-4 border-r font-medium">Data Teks/Angka</td>
                <td className="p-4 border-r text-center text-green-600">✅ PERMANEN</td>
                <td className="p-4 border-r text-center text-green-600">✅ PERMANEN</td>
                <td className="p-4 text-center text-green-600">✅ PERMANEN</td>
              </tr>
              <tr className="border-t">
                <td className="p-4 border-r font-medium">Foto Bukti</td>
                <td className="p-4 border-r text-center text-orange-600">⚠️ Hapus H+7</td>
                <td className="p-4 border-r text-center text-orange-600">⚠️ Hapus H+7</td>
                <td className="p-4 text-center text-green-600">✅ PERMANEN</td>
              </tr>
              <tr className="border-t bg-muted/30">
                <td className="p-4 border-r font-medium">Prioritas Server</td>
                <td className="p-4 border-r text-center">Low (Bisa antre)</td>
                <td className="p-4 border-r text-center">Medium</td>
                <td className="p-4 text-center text-green-600">High (VIP)</td>
              </tr>
              <tr className="border-t">
                <td className="p-4 border-r font-medium">Ekspor Excel</td>
                <td className="p-4 border-r text-center text-red-600">❌</td>
                <td className="p-4 border-r text-center text-red-600">❌</td>
                <td className="p-4 text-center text-green-600">✅</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ or Benefits Section */}
      <div className="mt-16 text-center">
        <h3 className="text-xl font-semibold mb-4">Mengapa Pilih Pro Business?</h3>
        <div className="grid md:grid-cols-3 gap-6 text-sm">
          <div className="bg-card border rounded-lg p-6">
            <Shield className="w-8 h-8 text-primary mx-auto mb-3" />
            <div className="font-medium mb-2">Arsip Aman Selamanya</div>
            <div className="text-muted-foreground">
              Foto dokumen tidak akan terhapus. Akses kapanpun untuk keperluan audit atau verifikasi.
            </div>
          </div>
          <div className="bg-card border rounded-lg p-6">
            <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
            <div className="font-medium mb-2">Akses Prioritas</div>
            <div className="text-muted-foreground">
              Bypass antrian server. Scan dokumen langsung diproses tanpa delay.
            </div>
          </div>
          <div className="bg-card border rounded-lg p-6">
            <Download className="w-8 h-8 text-primary mx-auto mb-3" />
            <div className="font-medium mb-2">Laporan Lengkap</div>
            <div className="text-muted-foreground">
              Export data ke Excel untuk analisis bisnis dan pelaporan yang profesional.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;