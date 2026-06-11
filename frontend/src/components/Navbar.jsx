import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 40px',
      borderBottom: '1px solid var(--border-color)',
      background: 'var(--bg-surface-solid)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '800',
            color: 'white'
          }}>AI</div>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.25rem',
            fontWeight: '700',
            letterSpacing: '-0.02em'
          }}>AI Project Interviewer</span>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {user && (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <Link to="/dashboard" style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-secondary)' }}>Dashboard</Link>
            <Link to="/upload" style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-secondary)' }}>Upload Project</Link>
          </div>
        )}

        <button 
          onClick={toggleTheme} 
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <button 
          onClick={() => {
            const currentKey = localStorage.getItem('gemini_api_key') || '';
            const newKey = prompt("Enter your Google Gemini API Key:", currentKey);
            if (newKey !== null) {
              localStorage.setItem('gemini_api_key', newKey.trim());
              window.location.reload();
            }
          }} 
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Configure Gemini API Key"
        >
          ⚙️
        </button>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Hi, <b>{user.name}</b>
            </span>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              Logout
            </button>
          </div>
        ) : (
          <button 
            onClick={() => {
              if (window.location.pathname !== '/') {
                navigate('/');
                setTimeout(() => {
                  document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              } else {
                document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="btn btn-primary" 
            style={{ padding: '8px 18px', fontSize: '0.85rem' }}
          >
            Get Started
          </button>
        )}
      </div>
    </nav>
  );
}
