import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { isGeminiConfigured, getGeminiApiKey, analyzeProject, setStatusCallback } from '../utils/gemini';
import JSZip from 'jszip';
import '../styles/dashboard.css';

export default function UploadProject() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'zip' or 'github'
  const [uploadMode, setUploadMode] = useState('zip');
  
  // Inputs
  const [projectName, setProjectName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  
  // Upload States
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  const hasApiKey = isGeminiConfigured();

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (!projectName) {
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setProjectName(baseName);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!projectName) {
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setProjectName(baseName);
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleSaveKey = (e) => {
    e.preventDefault();
    if (apiKeyInput.trim()) {
      localStorage.setItem('gemini_api_key', apiKeyInput.trim());
      window.location.reload();
    }
  };

  // Select key files to send to Gemini to optimize token usage
  const selectKeyFiles = (files) => {
    let totalLength = 0;
    const selected = [];
    
    const sorted = [...files].sort((a, b) => {
      const getScore = (p) => {
        const name = p.toLowerCase();
        if (name.endsWith('package.json') || name.endsWith('requirements.txt') || name.endsWith('gemfile') || name.endsWith('cargo.toml')) return 100;
        if (name.includes('app.js') || name.includes('main.py') || name.includes('index.js') || name.includes('app.jsx')) return 90;
        if (name.endsWith('.jsx') || name.endsWith('.tsx') || name.endsWith('.py') || name.endsWith('.go') || name.endsWith('.rs')) return 80;
        if (name.endsWith('.js') || name.endsWith('.ts')) return 70;
        if (name.endsWith('.html') || name.endsWith('.css')) return 50;
        return 10;
      };
      return getScore(b.path) - getScore(a.path);
    });

    for (const file of sorted) {
      if (totalLength + file.content.length < 80000 && selected.length < 20) {
        selected.push(file);
        totalLength += file.content.length;
      }
    }
    return selected;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!hasApiKey) {
      setError('Please configure your Gemini API Key first.');
      return;
    }

    if (!projectName.trim()) {
      setError('Please provide a project name.');
      return;
    }

    setLoading(true);
    
    try {
      let files = [];

      if (uploadMode === 'zip') {
        if (!selectedFile) {
          throw new Error('Please select a project ZIP file.');
        }
        
        setStatusMessage("Reading ZIP file in browser...");
        const zip = new JSZip();
        const zipContents = await zip.loadAsync(selectedFile);
        
        setStatusMessage("Extracting and scanning files...");
        for (const [path, zipEntry] of Object.entries(zipContents.files)) {
          if (!zipEntry.dir) {
            // Keep readable text/code files, skip binary/node_modules/cache
            const isCode = /\.(js|jsx|ts|tsx|py|html|css|json|md|go|rs|c|cpp|h|java|cs)$/i.test(path);
            const isIgnored = path.includes('node_modules/') || path.includes('.git/') || path.includes('venv/') || path.includes('__pycache__/') || path.includes('dist/') || path.includes('build/');
            if (isCode && !isIgnored) {
              try {
                const text = await zipEntry.async('string');
                if (text.trim().length > 0) {
                  files.push({ path, content: text, size: text.length });
                }
              } catch (err) {
                console.warn("Could not read file:", path, err);
              }
            }
          }
        }
      } else {
        if (!githubUrl.trim()) {
          throw new Error('Please provide a GitHub repository URL.');
        }

        setStatusMessage("Parsing GitHub Repository URL...");
        const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
          throw new Error("Invalid GitHub Repository URL. Make sure it follows: https://github.com/owner/repository");
        }
        const owner = match[1];
        const repo = match[2].replace(/\.git$/, '');

        setStatusMessage("Fetching repository file structure from GitHub...");
        // 1. Fetch default branch
        const repoInfo = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
          .then(res => {
            if (!res.ok) throw new Error("GitHub repository not found or is private.");
            return res.json();
          });
        const defaultBranch = repoInfo.default_branch || 'main';

        // 2. Fetch file tree recursively
        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
        const treeRes = await fetch(treeUrl);
        if (!treeRes.ok) {
          throw new Error("Failed to fetch repository tree. Ensure repository is public.");
        }
        const treeData = await treeRes.json();

        // 3. Filter for code files
        const codeFiles = treeData.tree.filter(item => {
          const isCode = /\.(js|jsx|ts|tsx|py|html|css|json|md|go|rs|c|cpp|h|java|cs)$/i.test(item.path);
          const isIgnored = item.path.includes('node_modules/') || item.path.includes('.git/') || item.path.includes('venv/') || item.path.includes('__pycache__/') || item.path.includes('dist/') || item.path.includes('build/');
          return item.type === 'blob' && isCode && !isIgnored;
        });

        if (codeFiles.length === 0) {
          throw new Error("No readable code files found in the repository.");
        }

        setStatusMessage(`Downloading project files from GitHub (downloading top ${Math.min(codeFiles.length, 15)})...`);
        // Limit to top 15 files to keep fetch requests low
        const filesToDownload = codeFiles.slice(0, 15);
        for (const item of filesToDownload) {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${item.path}`;
          try {
            const contentRes = await fetch(rawUrl);
            if (contentRes.ok) {
              const content = await contentRes.text();
              files.push({ path: item.path, content, size: content.length });
            }
          } catch (e) {
            console.error("Could not fetch file content:", item.path, e);
          }
        }
      }

      if (files.length === 0) {
        throw new Error("No code files could be successfully read.");
      }

      // Filter and limit files sent to Gemini
      const keyFiles = selectKeyFiles(files);

      // Run Single Combined Gemini Call (analysis + questions + resume in 1 API request)
      setStatusMessage("Analyzing codebase with Gemini AI...");
      // Connect Gemini's retry status to the UI so user sees countdown
      setStatusCallback((msg) => setStatusMessage(msg));
      const result = await analyzeProject(projectName, keyFiles);
      setStatusCallback(null); // Disconnect after done
      const analysis = result.analysis;
      const questions = result.questions;
      const resume = result.resume;

      // Insert directly into Supabase
      setStatusMessage("Saving records to Supabase database...");
      
      const { data: projectData, error: projectError } = await supabase.from('projects').insert({
        user_id: user.id,
        name: projectName,
        github_url: uploadMode === 'github' ? githubUrl : null,
        file_structure: files.map(f => ({ path: f.path, size: f.size })),
        tech_stack: analysis.detected_technologies,
        complexity_score: analysis.complexity_score || 50,
        quality_score: analysis.quality_score || 50,
        ats_score: analysis.ats_score || 50
      }).select().single();

      if (projectError) {
        throw new Error("Supabase Projects Save Error: " + projectError.message);
      }

      const projectId = projectData.id;

      const { error: analysisError } = await supabase.from('code_analyses').insert({
        project_id: projectId,
        beginner_summary: analysis.beginner_summary,
        technical_summary: analysis.technical_summary,
        recruiter_summary: analysis.recruiter_summary,
        linkedin_summary: analysis.linkedin_summary,
        explain_fresher: analysis.explain_fresher,
        explain_swe: analysis.explain_swe,
        explain_team_lead: analysis.explain_team_lead,
        explain_interview: analysis.explain_interview,
        diagrams_mermaid: analysis.diagrams_mermaid
      });

      if (analysisError) {
        throw new Error("Supabase Code Analysis Save Error: " + analysisError.message);
      }

      const questionsData = questions.map(q => ({
        project_id: projectId,
        difficulty: q.difficulty,
        question: q.question,
        ideal_answer: q.ideal_answer,
        interviewer_expectations: q.interviewer_expectations,
        common_mistakes: q.common_mistakes,
        best_practices: q.best_practices
      }));

      const { error: questionsError } = await supabase.from('questions').insert(questionsData);
      if (questionsError) {
        throw new Error("Supabase Questions Save Error: " + questionsError.message);
      }

      const { error: resumeError } = await supabase.from('resume_entries').insert({
        project_id: projectId,
        project_name: resume.project_name || projectName,
        description: resume.description,
        key_features: resume.key_features,
        technologies: resume.technologies,
        achievements: resume.achievements,
        ats_optimized_text: resume.ats_optimized_text
      });

      if (resumeError) {
        throw new Error("Supabase Resume Save Error: " + resumeError.message);
      }

      setStatusMessage("Project successfully saved!");
      navigate(`/dashboard?project=${projectId}`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during submission.');
      setLoading(false);
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="upload-container">
        <div className="glass-panel upload-card">
          <h2 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Add New Project</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '30px' }}>
            Submit your codebase via ZIP upload or paste a public GitHub URL to begin the interview analysis.
          </p>

          {error && <div className="error-banner" style={{ textAlign: 'left' }}>{error}</div>}

          {/* Prompt API key configuration if not set */}
          {!hasApiKey && (
            <div style={{
              background: 'rgba(255, 171, 0, 0.15)',
              border: '1px solid #ffab00',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
              textAlign: 'left'
            }}>
              <h4 style={{ color: '#ffab00', margin: '0 0 8px 0', fontSize: '1rem' }}>⚠️ Gemini API Key Required</h4>
              <p style={{ fontSize: '0.85rem', margin: '0 0 12px 0', color: 'var(--text-secondary)' }}>
                Since this application runs entirely serverless in your browser, you must provide your own Gemini API Key. Your key is stored locally in your browser and is never sent to any external server.
              </p>
              <form onSubmit={handleSaveKey} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Paste AI Studio API Key..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  style={{ margin: 0 }}
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  Save Key
                </button>
              </form>
            </div>
          )}

          {loading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 0',
              gap: '20px'
            }}>
              <div className="spinner" style={{ width: '50px', height: '50px' }}></div>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Analyzing Codebase</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', minHeight: '24px' }}>
                {statusMessage}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '500' }}>
                  Project Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. E-Commerce Backend"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                />
              </div>

              {/* Mode Toggler */}
              <div style={{
                display: 'flex',
                background: 'rgba(0, 0, 0, 0.15)',
                padding: '4px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: '24px'
              }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: uploadMode === 'zip' ? 'var(--primary)' : 'transparent',
                    color: uploadMode === 'zip' ? 'white' : 'var(--text-secondary)',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setUploadMode('zip')}
                >
                  📁 File / ZIP Upload
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: uploadMode === 'github' ? 'var(--primary)' : 'transparent',
                    color: uploadMode === 'github' ? 'white' : 'var(--text-secondary)',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setUploadMode('github')}
                >
                  🔗 GitHub Repo URL
                </button>
              </div>

              {uploadMode === 'zip' ? (
                /* ZIP Drag & Drop */
                <div 
                  className={`dropzone ${dragActive ? 'active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileSelect}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <div className="upload-icon">📥</div>
                  {selectedFile ? (
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--primary)', marginBottom: '4px' }}>
                        Selected File:
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '8px' }}>
                        Drag & Drop your project ZIP here
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        or click to browse local ZIP files
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* GitHub Input */
                <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '500' }}>
                    GitHub Repository URL
                  </label>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://github.com/username/repository"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    required={uploadMode === 'github'}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                    Note: The repository must be public.
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '20px' }}
                disabled={!hasApiKey}
              >
                Analyze Codebase
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
