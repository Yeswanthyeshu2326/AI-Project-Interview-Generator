import uvicorn
import os
import sys

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if __name__ == "__main__":
    print("Starting AI Project Interview Generator FastAPI backend...")
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
