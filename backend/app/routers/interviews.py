import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from backend.app.auth import get_current_user
from backend.app.database import get_db
from backend.app.models import User, Project, Question
from backend.app.schemas import QuestionResponse

router = APIRouter(prefix="/api/interviews", tags=["interviews"])

@router.get("/{project_id}/questions", response_model=List[QuestionResponse])
def get_questions(
    project_id: str,
    difficulty: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Authenticate project ownership
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    query = db.query(Question).filter(Question.project_id == project_id)
    if difficulty:
        query = query.filter(Question.difficulty == difficulty.lower())
        
    return query.all()

@router.get("/{project_id}/download-pdf")
def download_questions_pdf(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    questions = db.query(Question).filter(Question.project_id == project_id).all()
    if not questions:
        raise HTTPException(status_code=404, detail="No questions generated for this project yet.")
        
    # Generate PDF using ReportLab
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles for Premium Look
    title_style = ParagraphStyle(
        name="PDFTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#1A202C"), # Dark Slate
        alignment=0, # Left-aligned
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        name="PDFSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#718096"), # Slate grey
        spaceAfter=30
    )
    
    q_title_style = ParagraphStyle(
        name="PDFQuestion",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#2B6CB0"), # Slate blue
        spaceBefore=15,
        spaceAfter=8
    )
    
    bold_label_style = ParagraphStyle(
        name="PDFBoldLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#2D3748")
    )
    
    body_style = ParagraphStyle(
        name="PDFBodyText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#2D3748"),
        spaceAfter=10
    )
    
    story = []
    
    # Document Header
    story.append(Paragraph(f"AI Project Interview Q&A Guide", title_style))
    story.append(Paragraph(f"Project: {project.name} | Generated for: {current_user.name}", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Loop over questions
    for idx, q in enumerate(questions, start=1):
        q_elements = []
        # Question Title
        q_elements.append(Paragraph(f"Q{idx}. [{q.difficulty.upper()}] {q.question}", q_title_style))
        
        # Ideal Answer
        q_elements.append(Paragraph("<b>Ideal Answer:</b>", bold_label_style))
        q_elements.append(Paragraph(q.ideal_answer, body_style))
        
        # Expectations
        q_elements.append(Paragraph("<b>Interviewer Expectations:</b>", bold_label_style))
        q_elements.append(Paragraph(q.interviewer_expectations, body_style))
        
        # Mistakes
        q_elements.append(Paragraph("<b>Common Mistakes:</b>", bold_label_style))
        q_elements.append(Paragraph(q.common_mistakes, body_style))
        
        # Best Practices
        q_elements.append(Paragraph("<b>Best Practices:</b>", bold_label_style))
        q_elements.append(Paragraph(q.best_practices, body_style))
        
        # Divider Line/Space
        q_elements.append(Spacer(1, 15))
        
        # Keep each question block together to avoid breaking pages mid-question if possible
        story.append(KeepTogether(q_elements))
        
    doc.build(story)
    buffer.seek(0)
    
    # Clean filename
    clean_name = project.name.replace(" ", "_").lower()
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={clean_name}_interview_qa.pdf"}
    )
