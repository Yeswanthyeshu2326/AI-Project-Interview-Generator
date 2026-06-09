from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

# Auth Schemas
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[str] = None

# Project Schemas
class ProjectResponse(BaseModel):
    id: str
    name: str
    github_url: Optional[str] = None
    file_structure: Optional[Dict[str, Any]] = None
    tech_stack: Optional[List[str]] = None
    complexity_score: Optional[int] = None
    quality_score: Optional[int] = None
    ats_score: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Code Analysis Schemas
class CodeAnalysisResponse(BaseModel):
    id: str
    project_id: str
    beginner_summary: str
    technical_summary: str
    recruiter_summary: str
    linkedin_summary: str
    explain_fresher: str
    explain_swe: str
    explain_team_lead: str
    explain_interview: str
    diagrams_mermaid: Dict[str, str]  # {system: '...', flow: '...', component: '...'}
    created_at: datetime

    class Config:
        from_attributes = True

# Question Schemas
class QuestionResponse(BaseModel):
    id: str
    project_id: str
    difficulty: str
    question: str
    ideal_answer: str
    interviewer_expectations: str
    common_mistakes: str
    best_practices: str

    class Config:
        from_attributes = True

class QuestionListResponse(BaseModel):
    questions: List[QuestionResponse]

# Mock Session Schemas
class MockSessionCreate(BaseModel):
    project_id: str

class MockSessionResponse(BaseModel):
    id: str
    project_id: str
    status: str
    score: Optional[int] = None
    created_at: datetime
    project_name: Optional[str] = None

    class Config:
        from_attributes = True

class MockMessageCreate(BaseModel):
    message: str

class MockMessageResponse(BaseModel):
    id: str
    session_id: str
    sender: str
    message: str
    evaluation: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Resume Entry Schemas
class ResumeEntryResponse(BaseModel):
    id: str
    project_id: str
    project_name: str
    description: str
    key_features: List[str]
    technologies: List[str]
    achievements: List[str]
    ats_optimized_text: str

    class Config:
        from_attributes = True
