import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ScoreRing from '../components/ScoreRing';
import MermaidViewer from '../components/MermaidViewer';
import '../styles/dashboard.css';

// Recursive Tree Node Component
function TreeNode({ node }) {
  const [isOpen, setIsOpen] = useState(false);
  const isDir = node.type === 'directory';

  return (
    <div style={{ marginLeft: '12px', fontFamily: 'monospace', fontSize: '0.9rem' }}>
      <div 
        onClick={() => isDir && setIsOpen(!isOpen)} 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 6px',
          cursor: isDir ? 'pointer' : 'default',
          borderRadius: '4px',
          userSelect: 'none',
          background: isDir ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
          margin: '2px 0'
        }}
      >
        <span>{isDir ? (isOpen ? '📂' : '📁') : '📄'}</span>
        <span style={{ color: isDir ? 'var(--primary)' : 'var(--text-primary)' }}>{node.name}</span>
        {!isDir && node.size !== undefined && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            ({(node.size / 1024).toFixed(1)} KB)
          </span>
        )}
      </div>
      {isDir && isOpen && node.children && (
        <div style={{ borderLeft: '1px dashed var(--border-color)', marginLeft: '8px' }}>
          {node.children.map((child, idx) => (
            <TreeNode key={idx} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

// Convert flat list of file paths to hierarchical tree
function buildTree(fileList) {
  if (!fileList || !Array.isArray(fileList)) return null;
  const root = { name: 'Repository Root', type: 'directory', children: [] };
  
  for (const file of fileList) {
    const parts = file.path.split('/');
    let current = root;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      
      let child = current.children.find(c => c.name === part);
      if (!child) {
        child = {
          name: part,
          type: isLast ? 'file' : 'directory',
          size: isLast ? file.size : undefined,
          children: isLast ? undefined : []
        };
        current.children.push(child);
      }
      current = child;
    }
  }
  
  // Return the first child if there's only one root directory (e.g. repo name), otherwise the root itself
  if (root.children.length === 1 && root.children[0].type === 'directory') {
    return root.children[0];
  }
  return root;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeProjectId = searchParams.get('project');

  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  
  // UI Tabs State
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'explainers', 'tree', 'diagrams'
  const [summarySubTab, setSummarySubTab] = useState('beginner'); // 'beginner', 'technical', 'recruiter', 'linkedin'
  const [explainerSubTab, setExplainerSubTab] = useState('fresher'); // 'fresher', 'swe', 'lead', 'interview'
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch projects list from Supabase
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data, error: err } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (err) throw err;

        setProjects(data || []);
        
        // Determine project to display
        if (data && data.length > 0) {
          if (activeProjectId) {
            const matched = data.find(p => p.id === activeProjectId);
            if (matched) setActiveProject(matched);
            else setActiveProject(data[0]);
          } else {
            setActiveProject(data[0]);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load projects from Supabase.');
      }
    };
    if (user) {
      fetchProjects();
    }
  }, [user, activeProjectId]);

  // Fetch active project analysis from Supabase
  useEffect(() => {
    if (!activeProject) return;

    const fetchAnalysis = async () => {
      setLoading(true);
      setError('');
      try {
        const { data, error: err } = await supabase
          .from('code_analyses')
          .select('*')
          .eq('project_id', activeProject.id)
          .single();

        if (err) throw err;

        setAnalysis(data);
      } catch (err) {
        console.error(err);
        setError('Error loading analysis details from Supabase.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [activeProject]);

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm("Are you sure you want to delete this project analysis? This will wipe all mock history and QA logs.")) return;
    
    try {
      const { error: err } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (err) throw err;

      const remaining = projects.filter(p => p.id !== projectId);
      setProjects(remaining);
      if (remaining.length > 0) {
        navigate(`/dashboard?project=${remaining[0].id}`);
      } else {
        setActiveProject(null);
        setAnalysis(null);
      }
    } catch (err) {
      console.error("Delete project failed:", err);
      alert("Failed to delete project: " + err.message);
    }
  };

  if (projects.length === 0 && !loading) {
    return (
      <div className="page-container animate-fade-in" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '16px' }}>No Analyzed Projects Yet</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 30px auto' }}>
          Upload your ZIP folder codebase or link your GitHub repo to generate summaries, diagrams, interview sheets, and mock tests.
        </p>
        <Link to="/upload" className="btn btn-primary">Analyze a Project</Link>
      </div>
    );
  }

  // Construct directory tree dynamically
  const fileTree = activeProject ? buildTree(activeProject.file_structure) : null;

  return (
    <div className="page-container animate-fade-in" style={{ paddingBottom: '80px' }}>
      {/* Selector and Header */}
      <div className="dashboard-header">
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Project
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
            <select 
              value={activeProject?.id || ''}
              onChange={(e) => {
                const proj = projects.find(p => p.id === e.target.value);
                if (proj) navigate(`/dashboard?project=${proj.id}`);
              }}
              style={{
                background: 'var(--bg-surface-solid)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '8px 16px',
                borderRadius: '8px',
                fontFamily: 'var(--font-heading)',
                fontSize: '1.25rem',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Link to="/upload" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              ➕ New
            </Link>
            <button 
              onClick={() => handleDeleteProject(activeProject.id)}
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>

        {activeProject?.github_url && (
          <a 
            href={activeProject.github_url} 
            target="_blank" 
            rel="noreferrer"
            style={{ fontSize: '0.9rem', color: 'var(--primary)', textDecoration: 'underline' }}
          >
            🐙 View on GitHub
          </a>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '20px' }}>
          <div className="spinner"></div>
          <span>Loading project metrics & visuals...</span>
        </div>
      ) : error ? (
        <div className="error-banner">{error}</div>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="stats-row">
            <div className="glass-panel stat-card">
              <span className="stat-label">Complexity Score</span>
              <span className="stat-value primary">{activeProject.complexity_score}%</span>
            </div>
            
            <div className="glass-panel stat-card">
              <span className="stat-label">AI Quality Score</span>
              <ScoreRing score={activeProject.quality_score} size={80} strokeWidth={6} />
            </div>

            <div className="glass-panel stat-card">
              <span className="stat-label">ATS Resume Score</span>
              <ScoreRing score={activeProject.ats_score} size={80} strokeWidth={6} />
            </div>

            <div className="glass-panel stat-card">
              <span className="stat-label">Detected Tech Stack</span>
              <div className="tech-tags" style={{ justifyContent: 'center' }}>
                {activeProject.tech_stack?.slice(0, 4).map((tech, idx) => (
                  <span key={idx} className="tech-tag">{tech}</span>
                ))}
                {activeProject.tech_stack?.length > 4 && (
                  <span className="tech-tag" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}>
                    +{activeProject.tech_stack.length - 4}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Layout */}
          <div className="dashboard-grid">
            {/* Left Col: Main Explorer Tabs */}
            <div className="glass-panel" style={{ gridColumn: 'span 8', padding: '24px' }}>
              <div className="tabs-menu">
                <button 
                  className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                  onClick={() => setActiveTab('summary')}
                >
                  📝 Summaries
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'explainers' ? 'active' : ''}`}
                  onClick={() => setActiveTab('explainers')}
                >
                  🎓 Explainer Personas
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'tree' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tree')}
                >
                  📁 Directory Map
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'diagrams' ? 'active' : ''}`}
                  onClick={() => setActiveTab('diagrams')}
                >
                  📊 Architecture Diagrams
                </button>
              </div>

              {/* Subtab Panels */}
              {activeTab === 'summary' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {['beginner', 'technical', 'recruiter', 'linkedin'].map(sub => (
                      <button
                        key={sub}
                        onClick={() => setSummarySubTab(sub)}
                        style={{
                          background: summarySubTab === sub ? 'var(--primary-glow)' : 'transparent',
                          color: summarySubTab === sub ? 'var(--primary)' : 'var(--text-secondary)',
                          border: '1px solid',
                          borderColor: summarySubTab === sub ? 'var(--primary)' : 'var(--border-color)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          textTransform: 'capitalize'
                        }}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                  <div style={{ lineHeight: '1.7', fontSize: '0.98rem', whiteSpace: 'pre-wrap' }}>
                    {summarySubTab === 'beginner' && analysis.beginner_summary}
                    {summarySubTab === 'technical' && analysis.technical_summary}
                    {summarySubTab === 'recruiter' && analysis.recruiter_summary}
                    {summarySubTab === 'linkedin' && analysis.linkedin_summary}
                  </div>
                </div>
              )}

              {activeTab === 'explainers' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {[
                      { key: 'fresher', label: 'Fresher' },
                      { key: 'swe', label: 'Software Engineer' },
                      { key: 'lead', label: 'Team Lead' },
                      { key: 'interview', label: 'Interview Pitch' }
                    ].map(sub => (
                      <button
                        key={sub.key}
                        onClick={() => setExplainerSubTab(sub.key)}
                        style={{
                          background: explainerSubTab === sub.key ? 'var(--secondary-glow)' : 'transparent',
                          color: explainerSubTab === sub.key ? 'var(--secondary)' : 'var(--text-secondary)',
                          border: '1px solid',
                          borderColor: explainerSubTab === sub.key ? 'var(--secondary)' : 'var(--border-color)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ lineHeight: '1.7', fontSize: '0.98rem', whiteSpace: 'pre-wrap' }}>
                    {explainerSubTab === 'fresher' && analysis.explain_fresher}
                    {explainerSubTab === 'swe' && analysis.explain_swe}
                    {explainerSubTab === 'lead' && analysis.explain_team_lead}
                    {explainerSubTab === 'interview' && analysis.explain_interview}
                  </div>
                </div>
              )}

              {activeTab === 'tree' && (
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Codebase Tree Walker</h3>
                  <div style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '16px', borderRadius: '8px', maxHeight: '500px', overflowY: 'auto' }}>
                    {fileTree ? (
                      <TreeNode node={fileTree} />
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No folder structure found.</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'diagrams' && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>System Architecture Map</h3>
                  {analysis?.diagrams_mermaid?.architecture || analysis?.diagrams_mermaid?.system ? (
                    <MermaidViewer chart={analysis.diagrams_mermaid.architecture || analysis.diagrams_mermaid.system} />
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No architecture diagrams generated.</div>
                  )}
                </div>
              )}
            </div>

            {/* Right Col: Operations Center */}
            <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Interview Prep Center</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Link 
                    to={`/questions?project=${activeProject.id}`} 
                    className="btn btn-primary" 
                    style={{ textDecoration: 'none', width: '100%', padding: '12px' }}
                  >
                    📝 Q&A Questions Sheet
                  </Link>

                  <Link 
                    to={`/mock?project=${activeProject.id}`} 
                    className="btn btn-accent" 
                    style={{ textDecoration: 'none', width: '100%', padding: '12px' }}
                  >
                    💬 Live Mock Interview
                  </Link>

                  <Link 
                    to={`/resume?project=${activeProject.id}`} 
                    className="btn btn-secondary" 
                    style={{ textDecoration: 'none', width: '100%', padding: '12px' }}
                  >
                    📄 ATS Resume Builder
                  </Link>
                </div>
              </div>

              {/* Complete Stack detail */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Complete Tech Stack</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {activeProject.tech_stack?.map((tech, idx) => (
                    <span key={idx} className="tech-tag" style={{ background: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary)', borderColor: 'var(--primary-glow)' }}>
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
