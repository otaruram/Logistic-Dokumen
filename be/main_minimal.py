# Minimal FastAPI test
from fastapi import FastAPI

app = FastAPI(title="Test API", description="Minimal test API", version="1.0.0")

@app.get("/")
async def root():
    return {"message": "Minimal API is running!"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)