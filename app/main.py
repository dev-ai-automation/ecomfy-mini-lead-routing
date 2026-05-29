from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.db import models  # noqa: F401 - registers tables on Base.metadata
from app.adapters.db.seed import seed_buyers
from app.api.routes import router
from app.db import Base, SessionLocal, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_buyers(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="EcomfyApp Mini Lead Routing Engine",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "service": "ecomfy-mini-lead-routing",
        "docs": "/docs",
        "health": "/health",
    }
