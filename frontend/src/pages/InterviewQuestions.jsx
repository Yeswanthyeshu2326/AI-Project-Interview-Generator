import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { jsPDF } from 'jspdf';
import '../styles/dashboard.css';

function QuestionCard({ item, index }) {
  const [expanded, setExpanded] = useState(false);

  const diffColors = {
    beginner: { bg: 'rgba(16, 185, 129, 0.1)', text: 'var(--accent)', border: 'var(--accent-glow)' },
    intermediate: { bg: 'rgba(245, 158, 11, 0.1)', text: 'var(--warning)', border: 'rgba(245, 158, 11, 0.2)' },
    advanced: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--danger)', border: 'rgba(239, 68, 68, 0.2)' }
  };
  const dc = diffColors[item.difficulty] || diffColors.beginner;

  return (
    <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '10px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '12px' }}>
          <span style={{
            fontSize: '0.7rem',
            background: dc.bg,
            color: dc.text,
            border: `1px solid ${dc.border}`,
            padding: '2px 8px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            fontWeight: '700',
            whiteSpace: 'nowrap',
            letterSpacing: '0.3px'
          }}>
            {item.difficulty}
          </span>
          <span style={{ fontSize: '0.92rem', lineHeight: '1.35', fontWeight: '500' }}>
            Q{index}. {item.question}
          </span>
        </div>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div style={{
          marginTop: '14px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '2px' }}>
              💡 Ideal Answer
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.5', margin: 0 }}>
              {item.ideal_answer}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontWeight: '700', fontSize: '0.75rem', color: 'var(--secondary)', marginBottom: '3px' }}>
                🎯 Expectations
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                {item.interviewer_expectations}
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontWeight: '700', fontSize: '0.75rem', color: 'var(--danger)', marginBottom: '3px' }}>
                ⚠️ Mistakes
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                {item.common_mistakes}
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontWeight: '700', fontSize: '0.75rem', color: 'var(--accent)', marginBottom: '3px' }}>
                ✅ Best Practice
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
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
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  const [project, setProject] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  
  const [loading, setLoading] = useState(true);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId || !user) return;

    const fetchProjectAndQuestions = async () => {
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

        // Fetch questions
        let query = supabase
          .from('questions')
          .select('*')
          .eq('project_id', projectId);

        if (difficultyFilter !== 'all') {
          query = query.eq('difficulty', difficultyFilter);
        }

        const { data: qData, error: qErr } = await query;
        if (qErr) throw qErr;

        setQuestions(qData || []);
      } catch (err) {
        console.error(err);
        setError('Error downloading project details and questions from Supabase.');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectAndQuestions();
  }, [projectId, user, difficultyFilter]);

  const handleDownloadPDF = () => {
    if (!project || questions.length === 0) return;
    setPdfDownloading(true);
    try {
      const doc = new jsPDF();
      let y = 20;

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text(`${project.name} - Interview Prep Guide`, 20, y);
      y += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generated on ${new Date().toLocaleDateString()} via AI Project Interviewer`, 20, y);
      y += 15;

      questions.forEach((q, idx) => {
        // Page overflow check before printing question
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        const qText = `Q${idx + 1}. [${q.difficulty.toUpperCase()}] ${q.question}`;
        const splitQ = doc.splitTextToSize(qText, 170);
        doc.text(splitQ, 20, y);
        y += splitQ.length * 6 + 2;

        // Print Ideal Answer
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        
        const answerText = `Ideal Answer: ${q.ideal_answer}`;
        const splitA = doc.splitTextToSize(answerText, 170);
        
        // Overflow check before printing answer
        if (y + splitA.length * 5 > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(splitA, 20, y);
        y += splitA.length * 5 + 4;

        // Expectations
        const expectationsText = `Interviewer Expectations: ${q.interviewer_expectations}`;
        const splitE = doc.splitTextToSize(expectationsText, 170);
        if (y + splitE.length * 5 > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(splitE, 20, y);
        y += splitE.length * 5 + 3;

        // Common Mistakes
        const mistakesText = `Common Mistakes: ${q.common_mistakes}`;
        const splitM = doc.splitTextToSize(mistakesText, 170);
        if (y + splitM.length * 5 > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(splitM, 20, y);
        y += splitM.length * 5 + 3;

        // Best Practices
        const practicesText = `Best Practices: ${q.best_practices}`;
        const splitP = doc.splitTextToSize(practicesText, 170);
        if (y + splitP.length * 5 > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(splitP, 20, y);
        y += splitP.length * 5 + 8; // Extra padding between questions
      });

      const fileName = `${project.name.replace(/\s+/g, '_').toLowerCase()}_interview_qa.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error(err);
      alert("Error generating PDF: " + err.message);
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
          disabled={pdfDownloading || questions.length === 0}
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
