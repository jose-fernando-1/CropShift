
from fastapi import FastAPI

app = FastAPI(
    title="Rurotation API",
    description=(
        "Agricultural environmental suitability "
        "and planting window recommendation API"
    ),
    version="0.1.0",
)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}
