import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API_URL } from '../context/AuthContext';
import '../styles/dashboard.css';

export default function UploadProject() {
  const { token } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'zip' or 'github'
  const [uploadMode, setUploadMode] = useState('zip');
  
  // Inputs
  const [projectName, setProjectName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Upload States
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

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
        // Auto-populate project name from filename (excluding extension)
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!projectName.trim()) {
      setError('Please provide a project name.');
      return;
    }

    setLoading(true);
    
    // Step-by-step pipeline loading status simulator
    const steps = [
      "Uploading repository contents...",
      "Extracting zip files...",
      "Parsing directory structure & counting LOC...",
      "Detecting frameworks and technologies...",
      "Generating AI explanations and summaries...",
      "Synthesizing system architecture diagrams...",
      "Compiling tailored interview questions & answers...",
      "Finalizing database records..."
    ];

    let stepIdx = 0;
    setStatusMessage(steps[0]);
    const timer = setInterval(() => {
      if (stepIdx < steps.length - 1) {
        stepIdx++;
        setStatusMessage(steps[stepIdx]);
      }
    }, 3500);

    try {
      let response;
      if (uploadMode === 'zip') {
        if (!selectedFile) {
          throw new Error('Please select a project file (ZIP, code file, PDF, or image).');
        }
        
        const formData = new FormData();
        formData.append('name', projectName);
        formData.append('file', selectedFile);

        response = await fetch(`${API_URL}/api/projects/upload-zip`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      } else {
        if (!githubUrl.trim()) {
          throw new Error('Please provide a GitHub repository URL.');
        }

        const formData = new FormData();
        formData.append('name', projectName);
        formData.append('repo_url', githubUrl);

        response = await fetch(`${API_URL}/api/projects/import-github`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      }

      clearInterval(timer);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to process repository.');
      }

      const project = await response.json();
      navigate(`/dashboard?project=${project.id}`);
    } catch (err) {
      clearInterval(timer);
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
                        Drag & Drop your project file here
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        or click to browse local files (ZIP, code, PDF, or image)
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
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                    Note: The repository must be public.
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
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
