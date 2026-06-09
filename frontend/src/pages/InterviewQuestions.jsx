import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth, API_URL } from '../context/AuthContext';
import '../styles/dashboard.css';

function QuestionCard({ item, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px' }}>
      <div 
        onClick={() => setExpanded(!expanded)} 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingRight: '20px' }}>
          <span style={{
            fontSize: '0.8rem',
            background: 
              item.difficulty === 'beginner' ? 'rgba(16, 185, 129, 0.1)' :
              item.difficulty === 'intermediate' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: 
              item.difficulty === 'beginner' ? 'var(--accent)' :
              item.difficulty === 'intermediate' ? 'var(--warning)' : 'var(--danger)',
            border: '1px solid',
            borderColor: 
              item.difficulty === 'beginner' ? 'var(--accent-glow)' :
              item.difficulty === 'intermediate' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            padding: '2px 8px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            fontWeight: '600',
            marginTop: '2px'
          }}>
            {item.difficulty}
          </span>
          <h3 style={{ fontSize: '1.05rem', lineHeight: '1.4' }}>
            Q{index}. {item.question}
          </h3>
        </div>
        <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '4px' }}>
              Ideal Answer
            </div>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.6' }}>
              {item.ideal_answer}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '4px' }}>
                Interviewer Expectations
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {item.interviewer_expectations}
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '4px' }}>
                Common Mistakes
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {item.common_mistakes}
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '4px' }}>
                Best Practices
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {item.best_practices}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterviewQuestions() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  const [project, setProject] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  
  const [loading, setLoading] = useState(true);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;

    const fetchProjectAndQuestions = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch project metadata
        const projRes = await fetch(`${API_URL}/api/projects/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (projRes.ok) {
          const projData = await projRes.json();
          setProject(projData);
        }

        // Fetch questions
        const qUrl = difficultyFilter === 'all' 
          ? `${API_URL}/api/interviews/${projectId}/questions`
          : `${API_URL}/api/interviews/${projectId}/questions?difficulty=${difficultyFilter}`;
          
        const qRes = await fetch(qUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (qRes.ok) {
          const qData = await qRes.json();
          setQuestions(qData);
        } else {
          setError('Failed to load interview questions.');
        }
      } catch (err) {
        setError('Error downloading project details.');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectAndQuestions();
  }, [projectId, token, difficultyFilter]);

  const handleDownloadPDF = async () => {
    setPdfDownloading(true);
    try {
      const response = await fetch(`${API_URL}/api/interviews/${projectId}/download-pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.replace(/\s+/g, '_').lower()}_interview_qa.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert("Failed to export PDF file.");
      }
    } catch (err) {
      console.error(err);
      alert("Error generating PDF.");
    } finally {
      setPdfDownloading(false);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Link to={`/dashboard?project=${projectId}`} style={{ fontSize: '0.9rem', color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
            ← Back to Dashboard
          </Link>
          <h2 style={{ fontSize: '1.75rem' }}>{project ? `${project.name} - Interview Q&As` : 'Interview Q&As'}</h2>
        </div>

        <button 
          onClick={handleDownloadPDF} 
          className="btn btn-primary" 
          disabled={pdfDownloading}
          style={{ padding: '10px 20px' }}
        >
          {pdfDownloading ? 'Generating PDF...' : '📥 Download QA Guide (PDF)'}
        </button>
      </div>

      {/* Filter Menu */}
      <div style={{
        display: 'flex',
        gap: '8px',
        background: 'rgba(0,0,0,0.1)',
        padding: '6px',
        borderRadius: '8px',
        width: 'fit-content',
        marginBottom: '24px',
        border: '1px solid var(--border-color)'
      }}>
        {['all', 'beginner', 'intermediate', 'advanced'].map(level => (
          <button
            key={level}
            onClick={() => setDifficultyFilter(level)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: difficultyFilter === level ? 'var(--primary)' : 'transparent',
              color: difficultyFilter === level ? 'white' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.2s'
            }}
          >
            {level}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '20px' }}>
          <div className="spinner"></div>
          <span>Loading interview questions...</span>
        </div>
      ) : error ? (
        <div className="error-banner">{error}</div>
      ) : questions.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No questions match this difficulty filter.
        </div>
      ) : (
        <div>
          {questions.map((q, idx) => (
            <QuestionCard key={q.id} item={q} index={idx + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
