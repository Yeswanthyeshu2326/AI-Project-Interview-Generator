import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/landing.css';

export default function LandingPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();

  // Tab state: 'login' or 'register'
  const [authMode, setAuthMode] = useState('login');
  
  // Form values
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, redirect to dashboard
  React.useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (authMode === 'login') {
        await login(email, password);
      } else {
        if (!name) {
          throw new Error('Please enter your name.');
        }
        await register(name, email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container animate-fade-in" style={{ padding: '20px 20px 80px 20px' }}>
      {/* Hero Header */}
      <header className="landing-hero">
        <div className="landing-glow-blob"></div>
        <div className="landing-badge">AI Interview Preparation</div>
        <h1 className="landing-title">
          Master Your Project Presentations & <span>Technical Interviews</span>
        </h1>
        <p className="landing-subtitle">
          Upload any zip file or link your GitHub repo. Our AI maps your architecture, generates customized Q&As, designs diagrams, and runs live mock interview simulators.
        </p>
      </header>

      {/* Main Split: Value Props vs Auth Form */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '40px',
        alignItems: 'start',
        marginTop: '20px'
      }}>
        {/* Value Props */}
        <section className="features-section" style={{ padding: 0 }}>
          <h2 className="section-title" style={{ textAlign: 'left', fontSize: '1.75rem', marginBottom: '24px' }}>
            Why use AI Project Interviewer?
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel feature-card" style={{ padding: '24px' }}>
              <div className="feature-icon-wrapper">🔍</div>
              <h3>Automatic Repository Intelligence</h3>
              <p>Detect technologies, folder structure hierarchies, dependency maps, and overall LOC metrics dynamically.</p>
            </div>
            <div className="glass-panel feature-card" style={{ padding: '24px' }}>
              <div className="feature-icon-wrapper">🎯</div>
              <h3>Tailored Q&A Generators</h3>
              <p>Get 50+ interview questions, ideal explanations, interviewer checklists, and common mistakes built for your code.</p>
            </div>
            <div className="glass-panel feature-card" style={{ padding: '24px' }}>
              <div className="feature-icon-wrapper">💬</div>
              <h3>Interactive Mock Interviews</h3>
              <p>Practice speaking to a technical AI recruiter. Get real-time grading, confidence meters, and score transcripts.</p>
            </div>
          </div>
        </section>

        {/* Auth form */}
        <div id="auth-section" className="auth-panel-container" style={{ marginTop: 0 }}>
          <div className="glass-panel auth-form-card">
            <h2 className="auth-title">
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="auth-subtitle">
              {authMode === 'login' 
                ? 'Sign in to access your projects and session history' 
                : 'Register to start analyzing codebases today'}
            </p>

            {error && <div className="error-banner">{error}</div>}

            <form onSubmit={handleSubmit}>
              {authMode === 'register' && (
                <div className="auth-group">
                  <label htmlFor="auth-name">Full Name</label>
                  <input
                    id="auth-name"
                    type="text"
                    className="input-field"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="auth-group">
                <label htmlFor="auth-email">Email Address</label>
                <input
                  id="auth-email"
                  type="email"
                  className="input-field"
                  placeholder="jane.doe@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="auth-group">
                <label htmlFor="auth-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    className="input-field"
                    placeholder="••••••••"
                    style={{ paddingRight: '40px' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      zIndex: 2
                    }}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                disabled={submitting}
              >
                {submitting ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
                    <span>{authMode === 'login' ? 'Authenticating...' : 'Registering...'}</span>
                  </div>
                ) : (
                  authMode === 'login' ? 'Sign In' : 'Sign Up'
                )}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {authMode === 'login' ? (
                <span>
                  Don't have an account? 
                  <span className="auth-toggle-link" onClick={() => setAuthMode('register')}>Sign Up</span>
                </span>
              ) : (
                <span>
                  Already have an account? 
                  <span className="auth-toggle-link" onClick={() => setAuthMode('login')}>Sign In</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
