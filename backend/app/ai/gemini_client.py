import json
import re
import os
import google.generativeai as genai
from typing import Optional
from backend.app.config import settings
from backend.app.ai.prompts import (
    SYSTEM_ANALYZE_INSTRUCTION, ANALYZE_PROMPT_TEMPLATE,
    SYSTEM_QUESTIONS_INSTRUCTION, QUESTIONS_PROMPT_TEMPLATE,
    SYSTEM_MOCK_INSTRUCTION, SYSTEM_RESUME_INSTRUCTION
)

# Initialize Gemini if key is provided
api_configured = False
if settings.GEMINI_API_KEY:
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        api_configured = True
    except Exception as e:
        print(f"Warning: Failed to configure Gemini API: {str(e)}")

def clean_json_response(text: str) -> str:
    """
    Cleans markdown code blocks (e.g., ```json ... ```) from LLM output
    to return a clean JSON string.
    """
    text = text.strip()
    # Remove markdown code block wrappers
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        text = match.group(1).strip()
    else:
        # Sometimes there's just a leading ``` or trailing ```
        text = re.sub(r"^```(json)?", "", text)
        text = re.sub(r"```$", "", text)
    return text.strip()

def run_gemini_prompt(system_instruction: str, prompt_text: str, image_path: Optional[str] = None) -> str:
    """
    Executes a model call using Gemini's system instructions, prompt and optional image.
    """
    if not api_configured:
        raise ValueError("Gemini API key is not configured.")
        
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=system_instruction
    )
    
    contents = []
    if image_path and os.path.exists(image_path):
        try:
            import PIL.Image
            img = PIL.Image.open(image_path)
            contents.append(img)
        except Exception as e:
            print(f"Error loading image for Gemini call: {e}")
            
    contents.append(prompt_text)
    
    response = model.generate_content(
        contents,
        generation_config={"response_mime_type": "application/json"} if "json" in system_instruction.lower() else None
    )
    return response.text

# --- Mock Fallback Generators (For zero-config local runs) ---

def get_mock_analysis(project_name: str, tech_stack: list) -> dict:
    techs = ", ".join(tech_stack) if tech_stack else "HTML/CSS/JS"
    return {
        "quality_score": 85,
        "ats_score": 90,
        "beginner_summary": f"This is an intelligent project called {project_name} built using {techs}. It handles data ingestion, processing, and display for users in a responsive layout.",
        "technical_summary": f"The application architecture for {project_name} follows a modular pattern. It separates client concerns from data handlers. Utilizing {techs}, it operates an event-driven flow, writing configurations and database states concurrently.",
        "recruiter_summary": f"A production-ready code repository leveraging {techs}. Employs modern web conventions, structured logging, schema integrity, and asynchronous APIs to optimize user data rendering.",
        "linkedin_summary": f"🚀 Excited to share my latest project: {project_name}! Built with {techs}, it features robust performance, automated pipelines, and clean architecture. Check it out! #FullStack #Python #React #AI",
        "explain_fresher": f"This project is like a smart digital organizer. It takes your instructions, processes them using a backend built in {techs}, and shows you the result on your screen, keeping everything organized in a database.",
        "explain_swe": f"A full-stack MVC codebase implementing asynchronous handler routes, database triggers, and modular frontend components. Codebase state is managed via React hooks or state variables, communicating with Python controllers.",
        "explain_team_lead": f"A microservice-ready project highlighting dependency separation, robust logging policies, and unit-tested entry endpoints. Designed with database scalability and low-latency API routes in mind.",
        "explain_interview": f"I engineered {project_name} to address manual workflow inefficiencies. By selecting {techs}, I structured a decoupled architecture containing state-driven views and REST endpoints, ensuring fast render cycles and clean schemas.",
        "diagrams": {
            "system": 'graph TD\n    A[User Browser] -->|HTTP Requests| B[FastAPI Backend]\n    B -->|SQLAlchemy| C[(SQLite/Postgres Database)]\n    B -->|Gemini API SDK| D[Google AI Models]',
            "flow": 'graph TD\n    A[Upload ZIP / Repo Link] --> B[Repository Analyzer]\n    B -->|Code Parsing| C[Gemini AI Context Builder]\n    C -->|Generate QA & Diagrams| D[Dashboard Display]',
            "component": 'graph LR\n    subgraph Frontend Components\n    Navbar --> PageContainer\n    PageContainer --> Dashboard\n    PageContainer --> MockInterview\n    end\n    subgraph Backend Routers\n    MainRouter --> AuthRouter\n    MainRouter --> ProjectRouter\n    end'
        }
    }

def get_mock_questions(project_name: str, tech_stack: list, num_questions: int) -> list:
    techs = ", ".join(tech_stack) if tech_stack else "core languages"
    q_list = []
    
    levels = ["beginner", "intermediate", "advanced"]
    for i in range(num_questions):
        level = levels[i % 3]
        if level == "beginner":
            q_list.append({
                "difficulty": "beginner",
                "question": f"What was the motivation behind using {techs} in this project?",
                "ideal_answer": f"I chose {techs} because of their active developer ecosystem, support for rapid API development, and rich packages. It allowed me to separate frontend UI rendering from business logic operations effectively.",
                "interviewer_expectations": "Understand technology trade-offs, language properties, and ecosystem match.",
                "common_mistakes": "Saying 'because it was easy' or 'because I knew it' without offering a technical business justification.",
                "best_practices": "Mention scalability, library footprint, execution speeds, and support frameworks."
            })
        elif level == "intermediate":
            q_list.append({
                "difficulty": "intermediate",
                "question": f"Explain the folder structure and how layers communicate in {project_name}.",
                "ideal_answer": "The codebase is structured logically with separate directories for routers, schemas, models, and utility scripts. Controllers query database models via SQLAlchemy sessions and return schema-validated JSON responses to the React frontend.",
                "interviewer_expectations": "Assess comprehension of clean architecture, separation of concerns, and data flow layers.",
                "common_mistakes": "Mixing routing layers directly with database calls or ignoring controller patterns.",
                "best_practices": "Define request/response schemas, use dependency injection for database instances, and structure utils folders cleanly."
            })
        else:
            q_list.append({
                "difficulty": "advanced",
                "question": "If you had to scale this codebase to support 10,000 concurrent users, what bottlenecks would arise and how would you resolve them?",
                "ideal_answer": "The primary bottlenecks would be database read/write locks and synchronous blocking operations. I would introduce Redis for session and analysis caching, implement connection pooling, wrap FastAPI operations in async/await pools, and set up a Celery task queue for heavy AI operations.",
                "interviewer_expectations": "Test system design limits, database concurrency knowledge, caching strategies, and horizontal scaling capabilities.",
                "common_mistakes": "Simply saying 'I will buy a larger server' without detailing software layer optimizations.",
                "best_practices": "Discuss caching, database replication, index optimization, load balancing, and async workers."
            })
            
    return q_list

def get_mock_resume(project_name: str, tech_stack: list) -> dict:
    techs = ", ".join(tech_stack) if tech_stack else "Generative AI, FastAPI, React"
    return {
        "project_name": project_name,
        "description": f"Developed an AI-driven repository intelligence platform enabling developers to analyze project layouts and generate context-aware interview simulations.",
        "key_features": ["Automated codebase analysis", "Dynamic system architecture generator", "Interactive AI mock interview engine"],
        "technologies": tech_stack if tech_stack else ["Python", "FastAPI", "React", "Gemini API", "SQLAlchemy"],
        "achievements": [
            f"Integrated Gemini LLMs using prompt engineering to automatically analyze code and structures.",
            "Designed a custom CSS dashboard and visualizer, boosting responsive page loads by 40%.",
            "Structured SQLAlchemy database schemas supporting user history, mock logs, and custom analytics."
        ],
        "ats_optimized_text": f"AI Project Interview Generator | {techs}\n• Engineered a full-stack codebase intelligence tool utilizing Gemini LLM API to analyze projects, automatically mapping architectural dependency topologies.\n• Optimized context-stuffing pipelines processing project file trees, feeding structured AST data to generate 50+ interview questions with 90% accuracy.\n• Built an interactive mock interview simulator scoring candidate chat performance on a 0-100 scale, storing responses in a PostgreSQL/SQLite database."
    }

# --- Core API Calls ---

def analyze_project_ai(project_name: str, tech_stack: list, complexity_score: int, file_structure: dict, ai_context: str, image_path: Optional[str] = None) -> dict:
    if not api_configured:
        return get_mock_analysis(project_name, tech_stack)
        
    prompt = ANALYZE_PROMPT_TEMPLATE.format(
        project_name=project_name,
        tech_stack=", ".join(tech_stack),
        complexity_score=complexity_score,
        file_structure=json.dumps(file_structure, indent=2)[:3000],  # Clamp structure length
        ai_context=ai_context[:6000]                                 # Clamp code length
    )
    
    try:
        raw_response = run_gemini_prompt(SYSTEM_ANALYZE_INSTRUCTION, prompt, image_path)
        clean_response = clean_json_response(raw_response)
        return json.loads(clean_response)
    except Exception as e:
        print(f"Gemini Analysis Error: {str(e)}. Falling back to mock data.")
        return get_mock_analysis(project_name, tech_stack)

def generate_questions_ai(project_name: str, tech_stack: list, ai_context: str, num_questions: int = 15, image_path: Optional[str] = None) -> list:
    if not api_configured:
        return get_mock_questions(project_name, tech_stack, num_questions)
        
    prompt = QUESTIONS_PROMPT_TEMPLATE.format(
        project_name=project_name,
        tech_stack=", ".join(tech_stack),
        ai_context=ai_context[:7000],
        num_questions=num_questions
    )
    
    try:
        raw_response = run_gemini_prompt(
            SYSTEM_QUESTIONS_INSTRUCTION.format(num_questions=num_questions),
            prompt,
            image_path
        )
        clean_response = clean_json_response(raw_response)
        return json.loads(clean_response)
    except Exception as e:
        print(f"Gemini Question Generation Error: {str(e)}. Falling back to mock data.")
        return get_mock_questions(project_name, tech_stack, num_questions)

def evaluate_mock_turn_ai(project_name: str, tech_stack: list, chat_history: list) -> dict:
    """
    Evaluates the conversation history and generates the next interviewer question / feedback.
    chat_history contains a list of dicts: [{"sender": "interviewer/user", "message": "..."}]
    """
    if not api_configured:
        # Simple mock interviewer responder
        last_user_msg = ""
        for msg in reversed(chat_history):
            if msg["sender"] == "user":
                last_user_msg = msg["message"]
                break
                
        if not last_user_msg:
            return {
                "interviewer_response": "Welcome! I see this project is built with these technologies. Let's start with a foundational question: What is the main problem this project solves and how is it structured?",
                "evaluation": None
            }
            
        # Give a mock evaluation
        words_count = len(last_user_msg.split())
        score = min(50 + (words_count * 2), 95)
        return {
            "interviewer_response": f"Thanks for that explanation. It makes sense. For my next question, let's drill down: how did you handle error management and edge cases in the data flows?",
            "evaluation": {
                "score": int(score),
                "technical_accuracy": "You named the primary libraries correctly and gave a clear overview of the data pipelines.",
                "communication": "Your explanation is structured and flows well, though you could use more specific terminologies.",
                "completeness": "Good general coverage, but missed discussing specific file entry points or failover logic.",
                "confidence": "Tone feels clear and descriptive."
            }
        }
        
    # Standard AI logic
    history_formatted = ""
    for msg in chat_history:
        history_formatted += f"{msg['sender'].capitalize()}: {msg['message']}\n"
        
    prompt = f"Chat History:\n{history_formatted}\nGenerate the next turn in JSON format."
    system_inst = SYSTEM_MOCK_INSTRUCTION.format(
        project_name=project_name,
        tech_stack=", ".join(tech_stack)
    )
    
    try:
        raw_response = run_gemini_prompt(system_inst, prompt)
        clean_response = clean_json_response(raw_response)
        return json.loads(clean_response)
    except Exception as e:
        print(f"Gemini Mock Interview Error: {str(e)}. Falling back to mock responder.")
        # Re-run mock turn logic
        return evaluate_mock_turn_ai(project_name, tech_stack, [])

def generate_resume_ai(project_name: str, tech_stack: list, ai_context: str, image_path: Optional[str] = None) -> dict:
    if not api_configured:
        return get_mock_resume(project_name, tech_stack)
        
    prompt = f"Project Name: {project_name}\nTech Stack: {', '.join(tech_stack)}\nContext:\n{ai_context[:7000]}"
    
    try:
        raw_response = run_gemini_prompt(SYSTEM_RESUME_INSTRUCTION, prompt, image_path)
        clean_response = clean_json_response(raw_response)
        return json.loads(clean_response)
    except Exception as e:
        print(f"Gemini Resume Error: {str(e)}. Falling back to mock resume.")
        return get_mock_resume(project_name, tech_stack)
