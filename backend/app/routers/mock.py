from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.auth import get_current_user
from backend.app.database import get_db
from backend.app.models import User, Project, MockSession, MockMessage
from backend.app.schemas import (
    MockSessionCreate, MockSessionResponse, MockMessageCreate, MockMessageResponse
)
from backend.app.ai.gemini_client import evaluate_mock_turn_ai

router = APIRouter(prefix="/api/mock", tags=["mock"])

@router.post("/session", response_model=MockSessionResponse)
def start_session(
    payload: MockSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == payload.project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    # Create session
    session = MockSession(
        user_id=current_user.id,
        project_id=payload.project_id,
        status="active"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # AI generates the opening interviewer message
    ai_response = evaluate_mock_turn_ai(
        project_name=project.name,
        tech_stack=project.tech_stack,
        chat_history=[] # Empty history starts the chat
    )
    
    interviewer_msg = MockMessage(
        session_id=session.id,
        sender="interviewer",
        message=ai_response.get("interviewer_response", "Let's begin the interview. Can you describe your project?")
    )
    db.add(interviewer_msg)
    db.commit()
    
    # Return response
    return MockSessionResponse(
        id=session.id,
        project_id=session.project_id,
        status=session.status,
        score=session.score,
        created_at=session.created_at,
        project_name=project.name
    )

@router.post("/session/{session_id}/message", response_model=Dict[str, Any])
def send_message(
    session_id: str,
    payload: MockMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(MockSession).filter(MockSession.id == session_id, MockSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
        
    if session.status != "active":
        raise HTTPException(status_code=400, detail="This interview session is already completed.")
        
    # 1. Save candidate message
    user_msg = MockMessage(
        session_id=session.id,
        sender="user",
        message=payload.message
    )
    db.add(user_msg)
    db.commit()
    
    # 2. Gather history for AI
    db_messages = db.query(MockMessage).filter(MockMessage.session_id == session.id).order_by(MockMessage.created_at.asc()).all()
    chat_history = []
    for m in db_messages:
        chat_history.append({"sender": m.sender, "message": m.message})
        
    # 3. Call AI to evaluate candidate response and generate next question
    ai_eval = evaluate_mock_turn_ai(
        project_name=session.project.name,
        tech_stack=session.project.tech_stack,
        chat_history=chat_history
    )
    
    # 4. Save evaluation on the user's message
    user_msg.evaluation = ai_eval.get("evaluation")
    db.add(user_msg)
    
    # 5. Save new interviewer message
    interviewer_msg = MockMessage(
        session_id=session.id,
        sender="interviewer",
        message=ai_eval.get("interviewer_response", "Thank you. Let's move on to the next question.")
    )
    db.add(interviewer_msg)
    db.commit()
    
    return {
        "evaluation": ai_eval.get("evaluation"),
        "interviewer_response": interviewer_msg.message,
        "interviewer_msg_id": interviewer_msg.id
    }

@router.post("/session/{session_id}/complete", response_model=MockSessionResponse)
def complete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(MockSession).filter(MockSession.id == session_id, MockSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
        
    if session.status == "completed":
         return session
         
    # Compute average score
    user_messages = db.query(MockMessage).filter(
        MockMessage.session_id == session.id,
        MockMessage.sender == "user"
    ).all()
    
    scores = []
    for m in user_messages:
        if m.evaluation and isinstance(m.evaluation, dict) and "score" in m.evaluation:
            scores.append(m.evaluation["score"])
            
    avg_score = int(sum(scores) / len(scores)) if scores else 0
    
    session.status = "completed"
    session.score = avg_score
    db.commit()
    db.refresh(session)
    
    return MockSessionResponse(
        id=session.id,
        project_id=session.project_id,
        status=session.status,
        score=session.score,
        created_at=session.created_at,
        project_name=session.project.name
    )

@router.get("/sessions", response_model=List[MockSessionResponse])
def get_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sessions = db.query(MockSession).filter(MockSession.user_id == current_user.id).order_by(MockSession.created_at.desc()).all()
    
    # Map project names dynamically
    results = []
    for s in sessions:
        results.append(MockSessionResponse(
            id=s.id,
            project_id=s.project_id,
            status=s.status,
            score=s.score,
            created_at=s.created_at,
            project_name=s.project.name
        ))
    return results

@router.get("/session/{session_id}", response_model=Dict[str, Any])
def get_session_details(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(MockSession).filter(MockSession.id == session_id, MockSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
        
    messages = db.query(MockMessage).filter(MockMessage.session_id == session_id).order_by(MockMessage.created_at.asc()).all()
    
    return {
        "session": MockSessionResponse(
            id=session.id,
            project_id=session.project_id,
            status=session.status,
            score=session.score,
            created_at=session.created_at,
            project_name=session.project.name
        ),
        "messages": [
            MockMessageResponse(
                id=m.id,
                session_id=m.session_id,
                sender=m.sender,
                message=m.message,
                evaluation=m.evaluation,
                created_at=m.created_at
            ) for m in messages
        ]
    }
