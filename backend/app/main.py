import sys
import os

# Add parent directory (backend) and grandparent directory (project root) to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
grandparent_dir = os.path.dirname(parent_dir)

if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if grandparent_dir not in sys.path:
    sys.path.insert(0, grandparent_dir)

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import auth, projects, interviews, mock, resume

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
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
