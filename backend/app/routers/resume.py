import io
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.app.auth import get_current_user
from backend.app.database import get_db
from backend.app.models import User, Project, ResumeEntry
from backend.app.schemas import ResumeEntryResponse

router = APIRouter(prefix="/api/resume", tags=["resume"])

@router.get("/{project_id}", response_model=ResumeEntryResponse)
def get_resume_entry(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    entry = db.query(ResumeEntry).filter(ResumeEntry.project_id == project_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Resume entry not found for this project.")
    return entry

@router.get("/{project_id}/download-txt")
def download_resume_txt(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    entry = db.query(ResumeEntry).filter(ResumeEntry.project_id == project_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Resume entry not found for this project.")
        
    buffer = io.BytesIO(entry.ats_optimized_text.encode("utf-8"))
    
    clean_name = project.name.replace(" ", "_").lower()
    return StreamingResponse(
        buffer,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={clean_name}_resume_entry.txt"}
    )
