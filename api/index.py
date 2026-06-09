"""
Vercel Serverless Function entry point.
This file exposes the FastAPI app so Vercel's @vercel/python runtime
can serve it as a serverless ASGI application.
"""
import sys
import os

# Add project root to sys.path so 'backend' package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.main import app
