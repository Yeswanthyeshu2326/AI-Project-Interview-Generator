import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth, API_URL } from '../context/AuthContext';
import ScoreRing from '../components/ScoreRing';
import '../styles/mock.css';

export default function MockInterview() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  
  // Interactive loading toggles
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');

  const chatEndRef = useRef(null);

  // Auto-scroll chat history
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, submitting]);

  // Start/Fetch mock session
  useEffect(() => {
    if (!projectId) return;

    const startOrFetchSession = async () => {
      setLoading(true);
      setError('');
      try {
        // Find existing active session for this project, or start a new one
        const activeRes = await fetch(`${API_URL}/api/mock/sessions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (activeRes.ok) {
          const sessions = await activeRes.json();
          const active = sessions.find(s => s.project_id === projectId && s.status === 'active');
          
          if (active) {
            // Load this session's history
            const detailsRes = await fetch(`${API_URL}/api/mock/session/${active.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (detailsRes.ok) {
              const details = await detailsRes.json();
              setSession(details.session);
              setMessages(details.messages);
              setLoading(false);
              return;
            }
          }
        }

        // Otherwise, initialize a new mock interview session
        const initRes = await fetch(`${API_URL}/api/mock/session`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ project_id: projectId })
        });

        if (initRes.ok) {
          const newSession = await initRes.json();
          setSession(newSession);
          // Initial greeting message
          const detailsRes = await fetch(`${API_URL}/api/mock/session/${newSession.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (detailsRes.ok) {
            const details = await detailsRes.json();
            setMessages(details.messages);
          }
        } else {
          setError('Failed to configure mock interview.');
        }
      } catch (err) {
        setError('Error initializing the simulation.');
      } finally {
        setLoading(false);
      }
    };

    startOrFetchSession();
  }, [projectId, token]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputVal.trim() || submitting) return;

    const currentText = inputVal;
    setInputVal('');
    setSubmitting(true);

    // Append local user message optimistically
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      sender: 'user',
      message: currentText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await fetch(`${API_URL}/api/mock/session/${session.id}/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: currentText })
      });

      if (response.ok) {
        const reply = await response.json();
        
        // Update user message with evaluation, append interviewer response
        setMessages(prev => {
          const updated = [...prev];
          const userIdx = updated.findIndex(m => m.id === tempUserMsg.id);
          if (userIdx !== -1) {
            updated[userIdx].evaluation = reply.evaluation;
          }
          return [
            ...updated,
            {
              id: reply.interviewer_msg_id || `interviewer-${Date.now()}`,
              sender: 'interviewer',
              message: reply.interviewer_response,
              created_at: new Date().toISOString()
            }
          ];
        });
      } else {
        alert("Server failed to respond to message.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error sending response.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishInterview = async () => {
    if (!window.confirm("Are you sure you want to conclude the mock session and generate your scorecard?")) return;
    
    setFinishing(true);
    try {
      const response = await fetch(`${API_URL}/api/mock/session/${session.id}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const updatedSession = await response.json();
        setSession(updatedSession);
      } else {
        alert("Could not finalize mock session.");
      }
    } catch (err) {
      console.error(err);
      alert("Error finishing session.");
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px 0', gap: '20px' }}>
        <div className="spinner"></div>
        <span>Configuring AI interviewer environment...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="error-banner">{error}</div>
        <Link to="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" style={{ paddingBottom: '80px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to={`/dashboard?project=${projectId}`} style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>
          ← Back to Dashboard
        </Link>
        <h2 style={{ fontSize: '1.75rem', marginTop: '6px' }}>Mock Interview Simulator</h2>
      </div>

      {session.status === 'completed' ? (
        /* SCORECARD CARD SCREEN */
        <div className="glass-panel completion-screen">
          <h2 style={{ fontSize: '1.75rem', color: 'var(--accent)' }}>Interview Completed!</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Well done. You have successfully finished the mock presentation session for <b>{session.project_name}</b>.
          </p>

          <div className="completion-score-ring">
            <ScoreRing score={session.score} size={130} strokeWidth={8} />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>OVERALL SCORE</div>
          </div>

          <div className="feedback-bullets">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Session Performance Feedback</h3>
            
            {messages.filter(m => m.sender === 'user' && m.evaluation).map((m, idx) => (
              <div key={idx} style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid var(--border-color)',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--primary)' }}>Q: {m.message.slice(0, 50)}...</span>
                  <span style={{
                    fontSize: '0.8rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--accent)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: '700'
                  }}>Score: {m.evaluation.score}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  • <b>Accuracy:</b> {m.evaluation.technical_accuracy}<br/>
                  • <b>Communication:</b> {m.evaluation.communication}<br/>
                  • <b>Confidence:</b> {m.evaluation.confidence}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Link to={`/dashboard?project=${projectId}`} className="btn btn-primary">
              Return to Dashboard
            </Link>
            <button onClick={() => window.location.reload()} className="btn btn-secondary">
              Start New Interview
            </button>
          </div>
        </div>
      ) : (
        /* LIVE INTERACTIVE CHAT SCREEN */
        <div className="mock-layout">
          {/* Sidebar */}
          <div className="glass-panel interviewer-sidebar">
            <div className="interviewer-avatar">💬</div>
            <div className="interviewer-name">Vince AI</div>
            <div className="interviewer-title">Principal Technical Recruiter</div>
            
            <div className="interview-stats">
              <div className="interview-stat-row">
                <span className="interview-stat-label">Session Status</span>
                <span className="interview-stat-value" style={{ color: 'var(--accent)' }}>Active</span>
              </div>
              <div className="interview-stat-row">
                <span className="interview-stat-label">Questions Asked</span>
                <span className="interview-stat-value">
                  {messages.filter(m => m.sender === 'interviewer').length}
                </span>
              </div>
              
              <button 
                onClick={handleFinishInterview} 
                className="btn btn-secondary" 
                style={{ marginTop: '24px', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}
                disabled={finishing}
              >
                {finishing ? 'Closing...' : '🏁 End & Score Interview'}
              </button>
            </div>
          </div>

          {/* Chat Pane */}
          <div className="glass-panel chat-container">
            <div className="chat-history">
              {messages.map((m) => (
                <div 
                  key={m.id} 
                  className={`chat-bubble-wrapper ${m.sender}`}
                >
                  <span className="chat-sender-label">{m.sender === 'user' ? 'You' : 'Interviewer'}</span>
                  <div className="chat-bubble">
                    {m.message}
                  </div>
                  
                  {/* Inline Score evaluation feedback under user answers */}
                  {m.sender === 'user' && m.evaluation && (
                    <div className="eval-box">
                      <div className="eval-header">
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>AI Feedback</span>
                        <span className="eval-score-badge">Score: {m.evaluation.score}</span>
                      </div>
                      <div className="eval-grid">
                        <div>
                          <div className="eval-item-title">Accuracy</div>
                          <div className="eval-item-desc">{m.evaluation.technical_accuracy}</div>
                        </div>
                        <div>
                          <div className="eval-item-title">Communication</div>
                          <div className="eval-item-desc">{m.evaluation.communication}</div>
                        </div>
                        <div>
                          <div className="eval-item-title">Completeness</div>
                          <div className="eval-item-desc">{m.evaluation.completeness}</div>
                        </div>
                        <div>
                          <div className="eval-item-title">Tone Confidence</div>
                          <div className="eval-item-desc">{m.evaluation.confidence}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {submitting && (
                <div className="chat-bubble-wrapper interviewer">
                  <span className="chat-sender-label">Interviewer</span>
                  <div className="chat-bubble" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px' }}></div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Typing feedback...</span>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="chat-console">
              <input
                type="text"
                className="chat-input"
                placeholder="Type your technical response here..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={submitting}
              />
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={!inputVal.trim() || submitting}
              >
                Send Response
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
