import sys
import os

# Add project root to sys.path so 'backend' package is importable everywhere
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.database import engine, Base
from backend.app.routers import auth, projects, interviews, mock, resume

# Create database tables (automatic migrations for local development)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Project Interview Generator API",
    description="Backend services for analyzing codebases and generating interactive interview resources.",
    version="1.0.0"
)

# CORS Middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(interviews.router)
app.include_router(mock.router)
app.include_router(resume.router)

@app.get("/")
def read_root():
    return {"message": "AI Project Interview Generator API is running successfully."}

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
