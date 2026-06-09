import datetime
import uuid
from sqlalchemy import Column, String, Integer, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    mock_sessions = relationship("MockSession", back_populates="user", cascade="all, delete-orphan")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    github_url = Column(String, nullable=True)
    file_structure = Column(JSON, nullable=True)  # Tree representation
    tech_stack = Column(JSON, nullable=True)      # Array of strings
    complexity_score = Column(Integer, nullable=True)
    quality_score = Column(Integer, nullable=True)
    ats_score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="projects")
    analysis = relationship("CodeAnalysis", back_populates="project", uselist=False, cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="project", cascade="all, delete-orphan")
    mock_sessions = relationship("MockSession", back_populates="project", cascade="all, delete-orphan")
    resume_entries = relationship("ResumeEntry", back_populates="project", cascade="all, delete-orphan")

class CodeAnalysis(Base):
    __tablename__ = "code_analyses"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    beginner_summary = Column(Text, nullable=False)
    technical_summary = Column(Text, nullable=False)
    recruiter_summary = Column(Text, nullable=False)
    linkedin_summary = Column(Text, nullable=False)
    explain_fresher = Column(Text, nullable=False)
    explain_swe = Column(Text, nullable=False)
    explain_team_lead = Column(Text, nullable=False)
    explain_interview = Column(Text, nullable=False)
    diagrams_mermaid = Column(JSON, nullable=False)  # {system: '...', flow: '...', component: '...'}
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    project = relationship("Project", back_populates="analysis")

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    difficulty = Column(String, nullable=False)  # 'beginner', 'intermediate', 'advanced'
    question = Column(Text, nullable=False)
    ideal_answer = Column(Text, nullable=False)
    interviewer_expectations = Column(Text, nullable=False)
    common_mistakes = Column(Text, nullable=False)
    best_practices = Column(Text, nullable=False)
    
    project = relationship("Project", back_populates="questions")

class MockSession(Base):
    __tablename__ = "mock_sessions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="active")  # 'active', 'completed'
    score = Column(Integer, nullable=True)      # 0-100 score
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="mock_sessions")
    project = relationship("Project", back_populates="mock_sessions")
    messages = relationship("MockMessage", back_populates="session", cascade="all, delete-orphan")

class MockMessage(Base):
    __tablename__ = "mock_messages"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("mock_sessions.id", ondelete="CASCADE"), nullable=False)
    sender = Column(String, nullable=False)    # 'interviewer' or 'user'
    message = Column(Text, nullable=False)
    evaluation = Column(JSON, nullable=True)   # {score: 85, feedback: '...', elements: {...}}
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    session = relationship("MockSession", back_populates="messages")

class ResumeEntry(Base):
    __tablename__ = "resume_entries"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    project_name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    key_features = Column(JSON, nullable=False)     # Array of strings
    technologies = Column(JSON, nullable=False)     # Array of strings
    achievements = Column(JSON, nullable=False)     # Array of strings
    ats_optimized_text = Column(Text, nullable=False)
    
    project = relationship("Project", back_populates="resume_entries")
