from fastapi import FastAPI

app = FastAPI(title="Text Analysis Service")


@app.get("/health")
def health() -> dict:
  return {"status": "ok", "service": "text-analysis"}


@app.post("/analyze")
def analyze() -> dict:
  # Stub endpoint for MVP scaffold
  return {"segments": []}

