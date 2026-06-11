import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import '../styles/dashboard.css';

export default function ResumeGenerator() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  const [project, setProject] = useState(null);
  const [resumeData, setResumeData] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId || !user) return;

    const fetchResumeData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch project metadata
        const { data: projData, error: projErr } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projErr) throw projErr;
        setProject(projData);

        // Fetch resume content
        const { data: resData, error: resErr } = await supabase
          .from('resume_entries')
          .select('*')
          .eq('project_id', projectId)
          .single();

        if (resErr) throw resErr;
        setResumeData(resData);
      } catch (err) {
        console.error(err);
        setError('Error downloading resume contents from Supabase.');
      } finally {
        setLoading(false);
      }
    };

    fetchResumeData();
  }, [projectId, user]);

  const handleCopyClipboard = () => {
    if (!resumeData) return;
    navigator.clipboard.writeText(resumeData.ats_optimized_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!resumeData || !project) return;
    try {
      const bulletPoints = resumeData.achievements?.map(a => `• ${a}`).join('\n') || '';
      const textContent = `
=========================================
PROJECT: ${resumeData.project_name}
TECHNOLOGIES: ${resumeData.technologies?.join(', ') || ''}
=========================================

DESCRIPTION:
${resumeData.description}

KEY ACHIEVEMENTS & METRICS:
${bulletPoints}

ATS-OPTIMIZED KEYWORD DENSE BLOCK:
${resumeData.ats_optimized_text}
      `.trim();

      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_').toLowerCase()}_resume_entry.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error generating text file export.");
    }
  };

  if (!projectId) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2>Invalid Project ID</h2>
        <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '20px' }}>Go to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" style={{ paddingBottom: '80px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link to={`/dashboard?project=${projectId}`} style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>
          ← Back to Dashboard
        </Link>
        <h2 style={{ fontSize: '1.75rem', marginTop: '6px' }}>ATS Resume Project Builder</h2>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '20px' }}>
          <div className="spinner"></div>
          <span>Generating resume entries...</span>
        </div>
      ) : error ? (
        <div className="error-banner">{error}</div>
      ) : !resumeData ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No resume details generated for this project yet.
        </div>
      ) : (
        <div className="dashboard-grid">
          {/* Left Col: Structured Details */}
          <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>Key Technical Accomplishments</h3>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', lineHeight: '1.6', fontSize: '0.95rem' }}>
                {resumeData.achievements?.map((ach, idx) => (
                  <li key={idx}>
                    {ach}
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '12px' }}>Resume Meta Parameters</h3>
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                  PROJECT DESCRIPTION
                </span>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                  {resumeData.description}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                  CORE TECHNOLOGIES MATCHED
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {resumeData.technologies?.map((tech, idx) => (
                    <span key={idx} className="tech-tag" style={{ background: 'rgba(139, 92, 246, 0.08)', color: 'var(--secondary)', borderColor: 'var(--secondary-glow)' }}>
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Raw Copy Box */}
          <div className="glass-panel" style={{ gridColumn: 'span 5', padding: '24px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Copy-Paste Ready Entry</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Ready-made formatted text block featuring strong action verbs optimized for resume crawlers (ATS).
            </p>

            <textarea
              readOnly
              value={resumeData.ats_optimized_text}
              style={{
                width: '100%',
                height: '280px',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                resize: 'none',
                outline: 'none',
                marginBottom: '20px'
              }}
            />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={handleCopyClipboard} 
                className="btn btn-primary"
                style={{ flex: 1, padding: '12px' }}
              >
                {copied ? '✅ Copied to Clipboard!' : '📋 Copy Text'}
              </button>

              <button 
                onClick={handleDownloadTxt} 
                className="btn btn-secondary"
                style={{ padding: '12px' }}
              >
                📥 Download .txt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
