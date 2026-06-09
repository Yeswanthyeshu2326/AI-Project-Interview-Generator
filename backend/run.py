import uvicorn
import os
import sys

# Ensure backend and project root are in python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
project_root = os.path.dirname(backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

if __name__ == "__main__":
    print("Starting AI Project Interview Generator FastAPI backend...")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
