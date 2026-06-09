import os
import re
from typing import Dict, Any, List, Set

def detect_technologies(root_path: str, loc_stats: Dict[str, int]) -> List[str]:
    """
    Scans the repository to identify frameworks, libraries, databases, and tools.
    Utilizes file indicators, configurations (package.json, requirements.txt, pom.xml), and code imports.
    """
    detected: Set[str] = set()
    
    # Add languages found in LOC stats
    for lang, loc in loc_stats.items():
        if loc > 0:
            detected.add(lang)
            
    # Gather configuration content for text searches
    configs_content = ""
    source_content = ""
    
    for dirpath, dirnames, filenames in os.walk(root_path):
        # Exclude directories
        dirnames[:] = [d for d in dirnames if d not in {'.git', 'node_modules', 'venv', '.venv', 'build', 'dist'}]
        
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            file_path = os.path.join(dirpath, filename)
            
            # Check configurations
            if filename.lower() in {"package.json", "requirements.txt", "pom.xml", "build.gradle", "go.mod", "cargo.toml"}:
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        configs_content += f.read() + "\n"
                except Exception:
                    pass
            
            # Check imports in key code files (read first 50 lines to detect library imports)
            elif ext in {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go"}:
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = [f.readline() for _ in range(50)]
                        source_content += "\n".join(lines) + "\n"
                except Exception:
                    pass

    # Heuristic detections: Python ML / Data Science
    if "pandas" in configs_content or "pandas" in source_content:
        detected.add("Pandas")
    if "numpy" in configs_content or "numpy" in source_content:
        detected.add("NumPy")
    if "torch" in configs_content or "torch" in source_content or "pytorch" in configs_content:
        detected.add("PyTorch")
    if "tensorflow" in configs_content or "tensorflow" in source_content:
        detected.add("TensorFlow")
    if "sklearn" in configs_content or "sklearn" in source_content or "scikit-learn" in configs_content:
        detected.add("scikit-learn")
    if "nltk" in configs_content or "nltk" in source_content:
        detected.add("NLTK")
    if "spacy" in configs_content or "spacy" in source_content:
        detected.add("spaCy")
    if "transformers" in configs_content or "transformers" in source_content:
        detected.add("Hugging Face (Transformers)")

    # Python Web Frameworks
    if "flask" in configs_content or "flask" in source_content:
        detected.add("Flask")
    if "django" in configs_content or "django" in source_content:
        detected.add("Django")
    if "fastapi" in configs_content or "fastapi" in source_content or "uvicorn" in configs_content:
        detected.add("FastAPI")

    # JavaScript / Node / Frontend
    if "react" in configs_content or "react" in source_content:
        detected.add("React")
    if "angular" in configs_content or "@angular" in configs_content:
        detected.add("Angular")
    if "vue" in configs_content or "vue" in source_content:
        detected.add("Vue.js")
    if "next" in configs_content or "next" in source_content:
        detected.add("Next.js")
    if "express" in configs_content or "express" in source_content:
        detected.add("Express")
    if "nestjs" in configs_content or "@nestjs" in configs_content:
        detected.add("NestJS")
    if "svelte" in configs_content or "svelte" in source_content:
        detected.add("Svelte")

    # Java
    if "spring-boot" in configs_content or "springboot" in configs_content or "org.springframework.boot" in configs_content:
        detected.add("Spring Boot")
    if "hibernate" in configs_content or "hibernate" in source_content:
        detected.add("Hibernate")

    # Databases
    if any(x in configs_content or x in source_content for x in ["postgres", "postgresql", "psycopg2"]):
        detected.add("PostgreSQL")
    if any(x in configs_content or x in source_content for x in ["mysql", "pymysql"]):
        detected.add("MySQL")
    if any(x in configs_content or x in source_content for x in ["sqlite", "sqlite3"]):
        detected.add("SQLite")
    if any(x in configs_content or x in source_content for x in ["mongodb", "pymongo", "mongoose"]):
        detected.add("MongoDB")
    if "redis" in configs_content or "redis" in source_content:
        detected.add("Redis")

    # AWS & Cloud
    if any(x in configs_content or x in source_content for x in ["boto3", "aws-sdk", "aws_cdk", "s3", "dynamodb", "lambda"]):
        detected.add("AWS")
    if "docker" in configs_content.lower() or "dockerfile" in source_content.lower() or os.path.exists(os.path.join(root_path, "Dockerfile")):
        detected.add("Docker")
    if "kubernetes" in configs_content.lower() or "k8s" in configs_content.lower():
        detected.add("Kubernetes")

    # Fallback/General detections based on file extensions if configuration detection is sparse
    if "Java" in detected and not any(x in detected for x in ["Spring Boot", "Hibernate"]):
        detected.add("Java SE")

    # Infer underlying languages from frameworks
    if any(x in detected for x in ["React JS", "Vue.js", "Express", "Svelte", "Next.js"]):
        detected.add("JavaScript")
    if any(x in detected for x in ["React TS", "NestJS"]):
        detected.add("TypeScript")
    if any(x in detected for x in ["React JS", "React TS"]):
        detected.add("React")

    # Sort alphabetically and return as list
    return sorted(list(detected))

def calculate_complexity(total_loc: int, total_files: int, tech_stack: List[str]) -> int:
    """
    Computes a mock/formulaic complexity score from 1-100.
    Considers volume of files, lines of code, and technology density.
    """
    if total_files == 0:
        return 0
        
    # Standard base score from file count and lines of code
    loc_factor = min(total_loc / 500, 40)       # 40 points max for LOC (up to 20,000 LOC)
    files_factor = min(total_files * 2, 30)     # 30 points max for files count (up to 15 files)
    tech_factor = min(len(tech_stack) * 5, 30)  # 30 points max for tech count (up to 6 frameworks)
    
    score = int(loc_factor + files_factor + tech_factor)
    return max(10, min(score, 100)) # Clamped between 10 and 100
