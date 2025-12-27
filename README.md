# OCR.WTF (Omni Scan Suite)

**Professional Document Intelligence Platform**  
Scan, digitize, and manage documents with AI-powered precision.

![OCR.WTF Landing](../screenshot.png)

## 🚀 Key Features

### 📄 DGTNZ (Digitize)
The core engine of the platform.
- **AI OCR**: Powered by Tesseract + OpenAI GPT-4o-mini + Groq Llama 3 (Backup).
- **Auto-Correction**: Automatically fixes typos and structural errors in scanned text.
- **Format Agnostic**: Handles JPG, PNG, and PDF inputs.
- **Secure Storage**: Syncs directly to your Google Drive.

### 🎨 Modern Dashboard
- **Analytics**: Track your scanning activity and credit usage.
- **Cleanup**: Automatic 30-day data retention policy for privacy.
- **Responsive**: Fully optimized for Tablet and Desktop workflows.

---

## 🛠️ Tech Stack

### Frontend
- **React 18** (Vite)
- **TypeScript**
- **Shadcn/UI** + TailwindCSS
- **Framer Motion**

### Backend
- **FastAPI** (Python)
- **Supabase** (PostgreSQL + Auth)
- **Tesseract OCR**
- **OpenAI / Groq API**

---

## 📦 Installation (Local)

### Prerequisites
- Node.js 18+
- Python 3.10+
- Tesseract OCR installed locally

### 1. Clone & Setup
```bash
git clone https://github.com/otaruram/Logistic-Dokumen.git
cd Logistic-Dokumen
```

### 2. Backend Setup
```bash
cd be
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env 
# Configure .env with your keys
python main.py
```

### 3. Frontend Setup
```bash
cd fe
npm install
cp .env.example .env
npm run dev
```

---

## 🐳 Docker / VPS Deployment

Please refer to:
- [**Deployment Guide**](VPS_DEPLOYMENT_GUIDE.md): For step-by-step VPS setup.
- [**Docker Guide**](DOCKER-DEPLOYMENT-GUIDE.md): For containerized deployment.

---

## 📝 License
Proprietary software. All rights reserved.