import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { evaluateMockResponse } from '../utils/gemini';
import ScoreRing from '../components/ScoreRing';
import '../styles/mock.css';

export default function MockInterview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  const [project, setProject] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [questions, setQuestions] = useState([]);
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

  // Load project details
  useEffect(() => {
    if (!projectId || !user) return;

    const fetchProjectDetails = async () => {
      try {
        const { data: projData, error: projErr } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projErr) throw projErr;
        setProject(projData);

        const { data: qData, error: qErr } = await supabase
          .from('questions')
          .select('*')
          .eq('project_id', projectId);

        if (qErr) throw qErr;
        setQuestions(qData || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load project details.");
      }
    };

    fetchProjectDetails();
  }, [projectId, user]);

  // Start/Fetch mock session from Supabase
  useEffect(() => {
    if (!projectId || !user || !project) return;

    const startOrFetchSession = async () => {
      setLoading(true);
      setError('');
      try {
        // Find existing active session for this project
        const { data: activeSessions, error: activeErr } = await supabase
          .from('mock_sessions')
          .select('*')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .eq('status', 'active');

        if (activeErr) throw activeErr;

        if (activeSessions && activeSessions.length > 0) {
          const active = activeSessions[0];
          setSession(active);

          // Fetch messages
          const { data: msgsData, error: msgsErr } = await supabase
            .from('mock_messages')
            .select('*')
            .eq('session_id', active.id)
            .order('created_at', { ascending: true });

          if (msgsErr) throw msgsErr;
          setMessages(msgsData || []);
          setLoading(false);
          return;
        }

        // Initialize a new mock interview session
        const { data: newSession, error: initErr } = await supabase
          .from('mock_sessions')
          .insert({
            user_id: user.id,
            project_id: projectId,
            status: 'active'
          })
          .select()
          .single();

        if (initErr) throw initErr;
        setSession(newSession);

        // Add initial greeting message
        const greeting = `Hello! I am Vince, your technical interviewer today. I see you've submitted the project "${project.name}". Let's start with a general question: can you explain what this project does and the primary engineering problems you solved?`;
        
        const { data: greetingMsg, error: greetErr } = await supabase
          .from('mock_messages')
          .insert({
            session_id: newSession.id,
            sender: 'interviewer',
            message: greeting
          })
          .select()
          .single();

        if (greetErr) throw greetErr;
        setMessages([greetingMsg]);
      } catch (err) {
        console.error(err);
        setError('Error initializing the simulation.');
      } finally {
        setLoading(false);
      }
    };

    startOrFetchSession();
  }, [projectId, user, project]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputVal.trim() || submitting) return;

    const currentText = inputVal;
    setInputVal('');
    setSubmitting(true);

    // Save user message in Supabase
    try {
      const { data: userMsg, error: userMsgErr } = await supabase
        .from('mock_messages')
        .insert({
          session_id: session.id,
          sender: 'user',
          message: currentText
        })
        .select()
        .single();

      if (userMsgErr) throw userMsgErr;

      // Optimistically append user message
      setMessages(prev => [...prev, userMsg]);

      // Compile conversation history for Gemini context
      const messageHistory = messages.concat(userMsg).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.message }]
      }));

      // Evaluate response and generate follow-up using Gemini
      const reply = await evaluateMockResponse(project.name, questions, messageHistory, currentText);

      // Save user evaluation and interviewer reply in Supabase
      const { error: evalUpdateErr } = await supabase
        .from('mock_messages')
        .update({ evaluation: reply.evaluation })
        .eq('id', userMsg.id);

      if (evalUpdateErr) throw evalUpdateErr;

      const { data: interviewerMsg, error: interviewerErr } = await supabase
        .from('mock_messages')
        .insert({
          session_id: session.id,
          sender: 'interviewer',
          message: reply.interviewer_response
        })
        .select()
        .single();

      if (interviewerErr) throw interviewerErr;

      // Update message list
      setMessages(prev => {
        const updated = [...prev];
        const userIdx = updated.findIndex(m => m.id === userMsg.id);
        if (userIdx !== -1) {
          updated[userIdx].evaluation = reply.evaluation;
        }
        return [...updated, interviewerMsg];
      });
    } catch (err) {
      console.error(err);
      alert("Error sending message: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishInterview = async () => {
    if (!window.confirm("Are you sure you want to conclude the mock session and generate your scorecard?")) return;
    
    setFinishing(true);
    try {
      // Calculate overall session score based on user answers
      const userMsgs = messages.filter(m => m.sender === 'user' && m.evaluation?.score);
      const totalScore = userMsgs.reduce((acc, curr) => acc + curr.evaluation.score, 0);
      const finalScore = userMsgs.length > 0 ? Math.round(totalScore / userMsgs.length) : 75;

      const { data: updatedSession, error: updateErr } = await supabase
        .from('mock_sessions')
        .update({
          status: 'completed',
          score: finalScore
        })
        .eq('id', session.id)
        .select()
        .single();

      if (updateErr) throw updateErr;
      setSession(updatedSession);
    } catch (err) {
      console.error(err);
      alert("Error finishing session: " + err.message);
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
            Well done. You have successfully finished the mock presentation session for <b>{project?.name}</b>.
          </p>

          <div className="completion-score-ring">
            <ScoreRing score={session.score} size={130} strokeWidth={8} />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>OVERALL SCORE</div>
          </div>

          <div className="feedback-bullets">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Session Performance Feedback</h3>
            
            {messages.filter(m => m.sender === 'user' && m.evaluation).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No responses were submitted for detailed evaluations.</div>
            ) : (
              messages.filter(m => m.sender === 'user' && m.evaluation).map((m, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid var(--border-color)',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--primary)' }}>Answer: "{m.message.slice(0, 50)}..."</span>
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
                    • <b>Completeness:</b> {m.evaluation.completeness}<br/>
                    • <b>Confidence:</b> {m.evaluation.confidence}
                  </div>
                </div>
              ))
            )}
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
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Evaluating answer...</span>
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
