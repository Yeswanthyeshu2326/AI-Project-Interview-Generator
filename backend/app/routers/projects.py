import os
import shutil
import tempfile
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from backend.app.auth import get_current_user
from backend.app.database import get_db
from backend.app.models import User, Project, CodeAnalysis, Question, ResumeEntry
from backend.app.schemas import ProjectResponse, CodeAnalysisResponse
from backend.app.analyzer.repo_downloader import parse_github_url, download_github_zip, extract_uploaded_zip
from backend.app.analyzer.code_parser import analyze_codebase
from backend.app.analyzer.tech_detector import detect_technologies, calculate_complexity
from backend.app.ai.gemini_client import (
    analyze_project_ai, generate_questions_ai, generate_resume_ai
)

router = APIRouter(prefix="/projects", tags=["projects"])

def run_pipeline(project_name: str, repo_path: str, user_id: str, github_url: Optional[str], db: Session) -> Project:
    # 1. Analyze codebase files & LOC
    analysis_results = analyze_codebase(repo_path)
    
    # 2. Heuristics for tech stack & complexity
    loc_stats = analysis_results["loc_stats"]
    tech_stack = detect_technologies(repo_path, loc_stats)
    complexity = calculate_complexity(analysis_results["total_loc"], analysis_results["total_files"], tech_stack)
    
    # 3. Create Project record
    project = Project(
        user_id=user_id,
        name=project_name,
        github_url=github_url,
        file_structure=analysis_results["file_structure"],
        tech_stack=tech_stack,
        complexity_score=complexity,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    image_path = analysis_results.get("image_path")
    
    # 4. Trigger AI Summaries, explanations, and diagrams
    ai_analysis = analyze_project_ai(
        project_name=project.name,
        tech_stack=project.tech_stack,
        complexity_score=project.complexity_score,
        file_structure=project.file_structure,
        ai_context=analysis_results["ai_context"],
        image_path=image_path
      )
    
    project.quality_score = ai_analysis.get("quality_score", 80)
    project.ats_score = ai_analysis.get("ats_score", 80)
    db.commit()
    
    # 5. Create Code Analysis Record
    code_analysis = CodeAnalysis(
        project_id=project.id,
        beginner_summary=ai_analysis.get("beginner_summary", "Summary not generated."),
        technical_summary=ai_analysis.get("technical_summary", "Summary not generated."),
        recruiter_summary=ai_analysis.get("recruiter_summary", "Summary not generated."),
        linkedin_summary=ai_analysis.get("linkedin_summary", "Summary not generated."),
        explain_fresher=ai_analysis.get("explain_fresher", "Explanation not generated."),
        explain_swe=ai_analysis.get("explain_swe", "Explanation not generated."),
        explain_team_lead=ai_analysis.get("explain_team_lead", "Explanation not generated."),
        explain_interview=ai_analysis.get("explain_interview", "Explanation not generated."),
        diagrams_mermaid=ai_analysis.get("diagrams", {
            "system": "graph TD\n   A[User] --> B[App]",
            "flow": "graph TD\n   A[User] --> B[App]",
            "component": "graph TD\n   A[User] --> B[App]"
        })
    )
    db.add(code_analysis)
    
    # 6. Trigger AI Q&A Generation (Pre-generate 15 core questions: 5 Beginner, 5 Intermediate, 5 Advanced)
    questions_data = generate_questions_ai(
        project_name=project.name,
        tech_stack=project.tech_stack,
        ai_context=analysis_results["ai_context"],
        num_questions=15,
        image_path=image_path
    )
    
    for q_item in questions_data:
        question = Question(
            project_id=project.id,
            difficulty=q_item.get("difficulty", "intermediate"),
            question=q_item.get("question", "No question text"),
            ideal_answer=q_item.get("ideal_answer", "No answer text"),
            interviewer_expectations=q_item.get("interviewer_expectations", "No expectation details"),
            common_mistakes=q_item.get("common_mistakes", "No mistake details"),
            best_practices=q_item.get("best_practices", "No practice details")
        )
        db.add(question)
        
    # 7. Trigger AI Resume Generation
    resume_data = generate_resume_ai(
        project_name=project.name,
        tech_stack=project.tech_stack,
        ai_context=analysis_results["ai_context"],
        image_path=image_path
    )
    
    resume_entry = ResumeEntry(
        project_id=project.id,
        project_name=resume_data.get("project_name", project.name),
        description=resume_data.get("description", "No description generated."),
        key_features=resume_data.get("key_features", []),
        technologies=resume_data.get("technologies", project.tech_stack),
        achievements=resume_data.get("achievements", []),
        ats_optimized_text=resume_data.get("ats_optimized_text", "")
    )
    db.add(resume_entry)
    db.commit()
    
    return project

@router.post("/upload-zip", response_model=ProjectResponse)
def upload_zip(
    name: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Setup temporary environment
    temp_dir = tempfile.mkdtemp()
    
    try:
        is_zip = file.filename.lower().endswith(".zip")
        if is_zip:
            zip_path = os.path.join(temp_dir, file.filename)
            with open(zip_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            extracted_path = extract_uploaded_zip(zip_path, temp_dir)
        else:
            # Ingest single file, PDF, or image into a virtual project folder
            files_dir = os.path.join(temp_dir, "files")
            os.makedirs(files_dir, exist_ok=True)
            file_path = os.path.join(files_dir, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            extracted_path = files_dir
            
        project = run_pipeline(
            project_name=name,
            repo_path=extracted_path,
            user_id=current_user.id,
            github_url=None,
            db=db
        )
        return project
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process project file: {str(e)}"
        )
    finally:
        # Clean up temp directories
        shutil.rmtree(temp_dir, ignore_errors=True)

@router.post("/import-github", response_model=ProjectResponse)
async def import_github(
    name: str = Form(...),
    repo_url: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    owner, repo, branch = parse_github_url(repo_url)
    if not owner or not repo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid GitHub repository URL format."
        )
        
    # Setup temporary environment
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Download ZIPball from GitHub
        extracted_path = await download_github_zip(owner, repo, branch, temp_dir)
        project = run_pipeline(
            project_name=name,
            repo_path=extracted_path,
            user_id=current_user.id,
            github_url=repo_url,
            db=db
        )
        return project
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import GitHub repository: {str(e)}"
        )
    finally:
        # Clean up temp directories
        shutil.rmtree(temp_dir, ignore_errors=True)

@router.get("/", response_model=List[ProjectResponse])
def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Project).filter(Project.user_id == current_user.id).order_by(Project.created_at.desc()).all()

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project

@router.get("/{project_id}/analysis", response_model=CodeAnalysisResponse)
def get_project_analysis(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    analysis = db.query(CodeAnalysis).filter(CodeAnalysis.project_id == project_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis details not found.")
    return analysis

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    db.delete(project)
    db.commit()
    return None
