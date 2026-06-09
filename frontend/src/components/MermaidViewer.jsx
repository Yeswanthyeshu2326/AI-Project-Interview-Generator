import React, { useEffect, useState, useRef } from 'react';

// Counter to ensure unique IDs for rendering
let uniqueIdCounter = 0;

export default function MermaidViewer({ chart }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const currentId = `mermaid-chart-${++uniqueIdCounter}`;

    const loadAndRenderMermaid = async () => {
      try {
        // Ensure Mermaid script is loaded
        if (!window.mermaid) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Mermaid CDN script.'));
            document.body.appendChild(script);
          });
        }

        // Initialize Mermaid
        window.mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark',
          securityLevel: 'loose',
        });

        // Clear previous state
        if (isMounted) {
          setError(null);
        }

        // Render diagram
        const { svg: renderedSvg } = await window.mermaid.render(currentId, chart);
        
        if (isMounted) {
          setSvg(renderedSvg);
        }
      } catch (err) {
        console.error("Mermaid Render Error:", err);
        if (isMounted) {
          setError("Could not render diagram. Showing raw syntax.");
          // Clear error output container if mermaid appended error elements
          const errorSvg = document.getElementById(`d${currentId}`);
          if (errorSvg) {
            errorSvg.remove();
          }
        }
      }
    };

    if (chart) {
      loadAndRenderMermaid();
    }

    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div style={{ width: '100%' }}>
        <div style={{ color: 'var(--danger)', marginBottom: '12px', fontSize: '0.9rem' }}>⚠️ {error}</div>
        <pre style={{
          background: 'rgba(0, 0, 0, 0.2)',
          padding: '16px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          overflowX: 'auto',
          color: 'var(--text-secondary)'
        }}>{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
        <span>Generating architecture visualization...</span>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="mermaid-diagram-card glass-panel"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
}
