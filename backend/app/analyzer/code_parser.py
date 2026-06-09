import os
from typing import Dict, Any, List, Set, Tuple

EXCLUDE_DIRS: Set[str] = {
    '.git', 'node_modules', 'venv', '.venv', 'env', '__pycache__',
    '.idea', '.vscode', 'build', 'dist', 'target', 'out', '.next',
    '.nuxt', 'vendor', 'bower_components', 'bin', 'obj'
}

from pypdf import PdfReader

EXCLUDE_EXTS: Set[str] = {
    '.ico', '.zip', '.tar',
    '.gz', '.mp4', '.mp3', '.mov', '.woff', '.woff2', '.ttf', '.eot',
    '.exe', '.dll', '.so', '.dylib', '.class', '.pyc', '.db', '.sqlite',
    '.svg', '.dmg', '.pkg', '.war', '.jar', '.xml' # excluding xml generally unless config, pom.xml handled specifically
}

# Source code extensions to count LOC
CODE_EXTS: Dict[str, str] = {
    '.py': 'Python',
    '.js': 'JavaScript',
    '.jsx': 'React JS',
    '.ts': 'TypeScript',
    '.tsx': 'React TS',
    '.java': 'Java',
    '.go': 'Go',
    '.cs': 'C#',
    '.cpp': 'C++',
    '.c': 'C',
    '.h': 'C/C++ Header',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.html': 'HTML',
    '.css': 'CSS',
    '.rs': 'Rust',
    '.kt': 'Kotlin',
    '.swift': 'Swift',
    '.sh': 'Shell Script',
    '.sql': 'SQL'
}

KEY_CONFIGS: Set[str] = {
    'package.json', 'requirements.txt', 'pom.xml', 'build.gradle',
    'go.mod', 'cargo.toml', 'composer.json', 'setup.py', 'pipfile',
    'docker-compose.yml', 'dockerfile', 'readme.md', 'readme.txt',
    'application.properties', 'application.yml'
}

def extract_pdf_text(file_path: str) -> str:
    """
    Extracts text contents from a PDF file.
    """
    try:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text
    except Exception as e:
        print(f"Error reading PDF {file_path}: {e}")
        return ""

def build_tree(path: str, root_path: str, current_depth: int = 0, max_depth: int = 5) -> Dict[str, Any]:
    """
    Recursively builds a tree dictionary representation of a folder structure.
    """
    name = os.path.basename(path)
    relative_path = os.path.relpath(path, root_path)
    
    if os.path.isfile(path):
        return {
            "name": name,
            "path": relative_path,
            "type": "file",
            "size": os.path.getsize(path)
        }
        
    children = []
    if current_depth < max_depth:
        try:
            for item in os.listdir(path):
                if item in EXCLUDE_DIRS:
                    continue
                item_path = os.path.join(path, item)
                children.append(build_tree(item_path, root_path, current_depth + 1, max_depth))
        except Exception:
            pass # Handle permission errors gracefully
            
    # Sort children: directories first, then files alphabetically
    children.sort(key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()))
    
    return {
        "name": name if name else "root",
        "path": relative_path if relative_path != "." else "",
        "type": "directory",
        "children": children
    }

def analyze_codebase(root_path: str) -> Dict[str, Any]:
    """
    Scans the repository folder and compiles:
    1. Folder tree representation.
    2. LOC breakdown by language.
    3. Total metrics (LOC, files count).
    4. Key files selection for LLM context.
    """
    file_structure = build_tree(root_path, root_path)
    
    loc_stats: Dict[str, int] = {}
    file_counts: Dict[str, int] = {}
    total_files = 0
    total_loc = 0
    image_path = None
    
    # Store candidates for key code context
    config_files: List[Tuple[str, str]] = []  # (rel_path, content)
    readme_files: List[Tuple[str, str]] = []  # (rel_path, content)
    code_files: List[Tuple[str, str, int]] = []   # (rel_path, content, priority_score)
    
    for dirpath, dirnames, filenames in os.walk(root_path):
        # Exclude directories in-place to prevent os.walk from entering them
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext in EXCLUDE_EXTS:
                continue
                
            file_path = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(file_path, root_path)
            
            try:
                # 1. Handle Image Ingestion
                if ext in {".png", ".jpg", ".jpeg", ".gif"}:
                    total_files += 1
                    if not image_path:
                        image_path = file_path
                    continue
                
                # 2. Handle PDF Document Ingestion
                if ext == ".pdf":
                    total_files += 1
                    pdf_text = extract_pdf_text(file_path)
                    if pdf_text:
                        # Index PDF text at higher priority similar to readme context
                        readme_files.append((rel_path, pdf_text))
                    continue
                
                # Basic size limit for processing (ignore files > 1MB)
                file_size = os.path.getsize(file_path)
                if file_size > 1024 * 1024:
                    continue
                    
                # Read content safely
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    
                lines = content.splitlines()
                num_lines = len(lines)
                
                # Update general stats
                total_files += 1
                
                # Check if it's a known code extension
                lang = CODE_EXTS.get(ext)
                if lang:
                    loc_stats[lang] = loc_stats.get(lang, 0) + num_lines
                    file_counts[lang] = file_counts.get(lang, 0) + 1
                    total_loc += num_lines
                    
                    # Assign a code file priority score (e.g. main/index/app are higher, tests are lower)
                    priority = 5
                    filename_lower = filename.lower()
                    if any(x in filename_lower for x in ["main", "app", "index", "server", "routes", "controller", "model"]):
                        priority = 10
                    if any(x in filename_lower for x in ["test", "spec", "mock"]):
                        priority = 1
                        
                    # Lower priority for deeply nested files
                    priority -= min(rel_path.count(os.sep), 3)
                    
                    code_files.append((rel_path, content, priority))
                
                # Track configs and readme
                filename_lower = filename.lower()
                if filename_lower in KEY_CONFIGS:
                    if "readme" in filename_lower:
                        readme_files.append((rel_path, content))
                    else:
                        config_files.append((rel_path, content))
                        
            except Exception as e:
                # Log or ignore files that cannot be read
                print(f"Error reading file {file_path}: {e}")
                continue

    # Select key codebase files for the LLM context, keeping it under a strict token constraint
    # We will assemble:
    # 1. README contents
    # 2. Key configuration contents (e.g., package.json, requirements.txt)
    # 3. Best source code files (based on priority score, up to 10 files, each truncated if > 250 lines)
    
    selected_context = ""
    
    # 1. Add READMEs
    for path, content in readme_files[:2]:
        selected_context += f"--- FILE: {path} ---\n{content}\n\n"
        
    # 2. Add configurations
    for path, content in config_files[:5]:
        selected_context += f"--- FILE: {path} ---\n{content}\n\n"
        
    # 3. Add high priority code files
    code_files.sort(key=lambda x: x[2], reverse=True)
    # Limit code files to not overflow context (up to 8-10 files, truncated at 200 lines each)
    for path, content, _ in code_files[:10]:
        lines = content.splitlines()
        truncated = False
        if len(lines) > 200:
            lines = lines[:200]
            truncated = True
        file_text = "\n".join(lines)
        if truncated:
            file_text += "\n... [TRUNCATED FOR LENGTH] ..."
        selected_context += f"--- FILE: {path} ---\n{file_text}\n\n"

    return {
        "file_structure": file_structure,
        "loc_stats": loc_stats,
        "file_counts": file_counts,
        "total_files": total_files,
        "total_loc": total_loc,
        "ai_context": selected_context,
        "image_path": image_path
    }
