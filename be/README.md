# Backend - Supply Chain OCR System

## Tech Stack
- Python 3.9+
- FastAPI
- EasyOCR
- Uvicorn

## Struktur (akan dibuat)
```
be/
├── main.py              # FastAPI entry point
├── requirements.txt     # Python dependencies
├── .env                 # Environment variables
├── app/
│   ├── __init__.py
│   ├── api/
│   │   └── routes/
│   │       └── ocr.py   # OCR endpoints
│   ├── core/
│   │   └── config.py    # Configuration
│   └── services/
│       └── ocr_service.py  # OCR logic
└── tests/
```

## Setup (nanti)
```bash
cd be
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
