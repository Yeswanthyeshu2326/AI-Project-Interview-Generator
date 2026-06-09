import os
import zipfile
import shutil
import tempfile
import httpx
import re
from typing import Tuple, Optional

def parse_github_url(url: str) -> Tuple[Optional[str], Optional[str], str]:
    """
    Parses a GitHub URL to extract (owner, repo, branch/ref).
    Supports:
    - https://github.com/owner/repo
    - https://github.com/owner/repo.git
    - https://github.com/owner/repo/tree/branch_name
    """
    url = url.strip()
    if url.endswith(".git"):
        url = url[:-4]
        
    # Pattern matching for owners/repos/branches
    match = re.search(r"github\.com/([^/]+)/([^/]+)(/tree/([^/]+))?", url)
    if not match:
        return None, None, "main"
        
    owner = match.group(1)
    repo = match.group(2)
    branch = match.group(4) if match.group(4) else "main"
    return owner, repo, branch

async def download_github_zip(owner: str, repo: str, branch: str, temp_dir: str) -> str:
    """
    Downloads a repository zip from GitHub and extracts it to temp_dir.
    Tries primary branch (e.g. main) and falls back to master if 404.
    """
    zip_path = os.path.join(temp_dir, f"{repo}.zip")
    extract_path = os.path.join(temp_dir, "extracted")
    os.makedirs(extract_path, exist_ok=True)
    
    # Try downloading using heads/{branch}.zip
    download_urls = [
        f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip",
        f"https://github.com/{owner}/{repo}/archive/refs/heads/master.zip" if branch == "main" else None,
        f"https://github.com/{owner}/{repo}/zipball/{branch}"
    ]
    # Filter none
    download_urls = [u for u in download_urls if u]
    
    downloaded = False
    async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
        for url in download_urls:
            try:
                response = await client.get(url)
                if response.status_code == 200:
                    with open(zip_path, "wb") as f:
                        f.write(response.content)
                    downloaded = True
                    break
            except Exception as e:
                print(f"Failed to download from {url}: {str(e)}")
                continue
                
    if not downloaded:
        raise Exception(f"Could not download repository {owner}/{repo}. Make sure the repository is public and branch exists.")
        
    # Extract
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_path)
        
    # Clean up zip
    os.remove(zip_path)
    
    # Github zips extract into a subfolder like repo-name-branch-name or repo-name-commit-hash
    # We want to find that folder and return it.
    subdirs = [os.path.join(extract_path, d) for d in os.listdir(extract_path) if os.path.isdir(os.path.join(extract_path, d))]
    if len(subdirs) == 1:
        return subdirs[0]
    return extract_path

def extract_uploaded_zip(zip_file_path: str, temp_dir: str) -> str:
    """
    Extracts an uploaded zip file into the temp_dir.
    """
    extract_path = os.path.join(temp_dir, "extracted")
    os.makedirs(extract_path, exist_ok=True)
    
    with zipfile.ZipFile(zip_file_path, 'r') as zip_ref:
        zip_ref.extractall(extract_path)
        
    # If it extracted to a single subdirectory, use that
    subdirs = [os.path.join(extract_path, d) for d in os.listdir(extract_path) if os.path.isdir(os.path.join(extract_path, d))]
    # Filter out OS specific noise folders
    subdirs = [s for s in subdirs if not os.path.basename(s).startswith("__MACOSX")]
    if len(subdirs) == 1:
        return subdirs[0]
    return extract_path
