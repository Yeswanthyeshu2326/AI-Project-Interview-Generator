"""
Vercel Serverless Function entry point.
This file exposes the FastAPI app so Vercel's @vercel/python runtime
can serve it as a serverless ASGI application.
"""
import sys
import os

# Add project root and backend folder to sys.path so packages are importable
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, "backend"))

from app.main import app
