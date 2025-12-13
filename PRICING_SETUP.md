# Pricing System Documentation
# 📋 Panduan Implementasi Fitur Pricing

## 🗂️ File Structure yang telah dibuat:

```
be/
├── pricing_schema_reference.prisma    # Database schema reference
├── pricing_service.py                 # Core business logic 
├── pricing_endpoints.py               # API endpoints
├── pricing_cron.py                    # Scheduled jobs
└── pricing_integration.py             # Integration guide

fe/src/pages/
└── Pricing.tsx                        # Pricing page UI
```

## 🔧 Langkah Aktivasi (BELUM DIAKTIFKAN):

### 1. Database Migration
```bash
# Update schema.prisma dengan pricing tables
# Run: prisma db push
```

### 2. Backend Integration
```python
# Di main.py, tambahkan:
from pricing_endpoints import add_pricing_endpoints
from pricing_integration import ScanCreditChecker

# Add pricing endpoints
add_pricing_endpoints(app, prisma, get_user_email_from_token)
```

### 3. Frontend Routing
```typescript
// Di App.tsx, tambahkan route:
<Route path="/pricing" element={<Pricing />} />
```

### 4. Credit System Integration
```python
# Modifikasi scan endpoint untuk check credit
# Lihat contoh di pricing_integration.py
```

## 💰 Pricing Structure:

| Plan | Price | Credits | Image Storage | Features |
|------|-------|---------|---------------|----------|
| Starter | Rp 0 | 10 (once) | 7 days | Basic |
| Top-Up | Rp 10k-35k | 20/50/100 | 7 days | Extended |
| Pro | Rp 49k/month | 200/month | Permanent | Premium |

## 🚀 Features yang akan aktif:

✅ Credit-based scanning
✅ Automatic image cleanup (7 days for free users)
✅ Pro subscription with permanent storage  
✅ Priority server access for Pro users
✅ Excel export for Pro users
✅ Payment integration ready (Midtrans)
✅ Admin panel for credit management

## ⚠️ Catatan Penting:

- **Belum diaktifkan** - masih dalam bentuk kerangka
- Perlu setup payment gateway (Midtrans)
- Perlu migration database schema
- Perlu testing sebelum production
- File .env perlu ditambah config pricing

## 🎯 Next Steps untuk Aktivasi:

1. Setup database tables baru
2. Integrate dengan main.py  
3. Add pricing page ke routing
4. Setup payment gateway
5. Testing end-to-end
6. Deploy dan monitoring

Sistem pricing sudah siap untuk diaktifkan kapanpun dibutuhkan! 🔥