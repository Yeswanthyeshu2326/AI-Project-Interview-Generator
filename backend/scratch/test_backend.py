import os
import sys
import tempfile
import shutil
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure project root and backend folder are in system path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, "backend"))

from app.analyzer.code_parser import analyze_codebase
from app.analyzer.tech_detector import detect_technologies, calculate_complexity
from app.database import Base
from app.models import User, Project, CodeAnalysis
from app.auth import get_password_hash, verify_password

class TestBackendPipeline(unittest.TestCase):
    def setUp(self):
        # Create a temporary folder structure to simulate a project repo
        self.test_dir = tempfile.mkdtemp()
        
        # Create package.json indicating a React project
        with open(os.path.join(self.test_dir, "package.json"), "w") as f:
            f.write('{"dependencies": {"react": "^18.2.0", "react-dom": "^18.2.0"}}')
            
        # Create a source file
        os.makedirs(os.path.join(self.test_dir, "src"), exist_ok=True)
        with open(os.path.join(self.test_dir, "src", "App.jsx"), "w") as f:
            f.write('import React from "react";\nexport default function App() { return <div>Hello World</div>; }')
            
        # Create a README
        with open(os.path.join(self.test_dir, "README.md"), "w") as f:
            f.write('# Test Project\nAn application built in React.')

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_codebase_parser(self):
        analysis = analyze_codebase(self.test_dir)
        self.assertIn("React JS", analysis["loc_stats"])
        self.assertEqual(analysis["total_files"], 3)
        self.assertTrue(len(analysis["ai_context"]) > 0)
        self.assertEqual(analysis["file_structure"]["name"], os.path.basename(self.test_dir))

    def test_tech_detector(self):
        analysis = analyze_codebase(self.test_dir)
        techs = detect_technologies(self.test_dir, analysis["loc_stats"])
        self.assertIn("React", techs)
        self.assertIn("JavaScript", techs)
        
        complexity = calculate_complexity(analysis["total_loc"], analysis["total_files"], techs)
        self.assertTrue(10 <= complexity <= 100)

    def test_database_and_auth(self):
        # Verify in-memory DB tables construction and relations
        engine = create_engine("sqlite:///:memory:")
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)
        
        db = TestingSessionLocal()
        
        # Test Password hashing
        pw = "test_pass_123"
        hashed = get_password_hash(pw)
        self.assertTrue(verify_password(pw, hashed))
        self.assertFalse(verify_password("wrong", hashed))
        
        # Test models inserts
        user = User(name="Test User", email="test@example.com", hashed_password=hashed)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        proj = Project(
            user_id=user.id,
            name="Sample E-Commerce",
            tech_stack=["React", "Node.js"],
            complexity_score=45
        )
        db.add(proj)
        db.commit()
        db.refresh(proj)
        
        analysis = CodeAnalysis(
            project_id=proj.id,
            beginner_summary="beginner text",
            technical_summary="tech text",
            recruiter_summary="recruiter text",
            linkedin_summary="social text",
            explain_fresher="fresher expl",
            explain_swe="swe expl",
            explain_team_lead="lead expl",
            explain_interview="interview pitch",
            diagrams_mermaid={"system": "graph TD", "flow": "graph LR", "component": "graph TD"}
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        
        self.assertEqual(db.query(User).count(), 1)
        self.assertEqual(db.query(Project).filter(Project.user_id == user.id).count(), 1)
        self.assertEqual(db.query(CodeAnalysis).filter(CodeAnalysis.project_id == proj.id).first().beginner_summary, "beginner text")
        
        db.close()

if __name__ == "__main__":
    unittest.main()
