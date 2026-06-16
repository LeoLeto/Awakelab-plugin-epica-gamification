from fastapi import FastAPI
from dotenv import load_dotenv

from routers import pairs

load_dotenv()

app = FastAPI(title="Memory3D AI Microservice")

app.include_router(pairs.router, prefix="/api", tags=["memory3d"])


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Memory3D microservice is running"}
