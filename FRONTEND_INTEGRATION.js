// Frontend Integration Examples for DeepTrust Enhanced AI

// ============================================================
// 1. Basic Fetch Request
// ============================================================

async function verifyClaimBasic(claimText) {
  try {
    const response = await fetch('http://localhost:5000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: claimText })
    });

    const result = await response.json();
    console.log(result);
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage
verifyClaimBasic("Is it true CSK won IPL in 2021?");


// ============================================================
// 2. React Hook (Complete Example)
// ============================================================

import { useState } from 'react';

export function useFactCheck() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const verifyClaim = async (claimText) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: claimText })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { verifyClaim, loading, result, error };
}

// Usage in Component
function FactCheckComponent() {
  const { verifyClaim, loading, result, error } = useFactCheck();
  const [claim, setClaim] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await verifyClaim(claim);
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="Enter claim to verify..."
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      {error && <div className="error">Error: {error}</div>}

      {result && (
        <div className="result">
          <h3>Status: {result.status}</h3>
          <p>Confidence: {result.confidence}%</p>
          <p>{result.explanation}</p>

          {result.ai_analysis && (
            <>
              <h4>Key Facts:</h4>
              <ul>
                {result.ai_analysis.key_facts.map((fact, i) => (
                  <li key={i}>{fact}</li>
                ))}
              </ul>

              {result.ai_analysis.red_flags.length > 0 && (
                <>
                  <h4>Red Flags:</h4>
                  <ul>
                    {result.ai_analysis.red_flags.map((flag, i) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {result.sources && result.sources.length > 0 && (
            <>
              <h4>Sources:</h4>
              <ul>
                {result.sources.map((source, i) => (
                  <li key={i}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      {source.title} - {source.source}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================
// 3. Result Styling Helper
// ============================================================

function getStatusColor(status) {
  const colors = {
    'True': '#22c55e',          // green-500
    'Likely True': '#84cc16',   // lime-500
    'Unverified': '#fbbf24',    // amber-400
    'Misleading': '#f97316',    // orange-500
    'Likely Fake': '#ef4444',   // red-500
    'Fake': '#dc2626'           // red-600
  };
  return colors[status] || '#6b7280';
}

function getStatusIcon(status) {
  const icons = {
    'True': '✓',
    'Likely True': '✓',
    'Unverified': '?',
    'Misleading': '⚠',
    'Likely Fake': '✗',
    'Fake': '✗'
  };
  return icons[status] || '?';
}

// Usage
function StatusBadge({ status }) {
  return (
    <div 
      style={{
        backgroundColor: getStatusColor(status),
        color: 'white',
        padding: '8px 16px',
        borderRadius: '8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      <span>{getStatusIcon(status)}</span>
      <span>{status}</span>
    </div>
  );
}


// ============================================================
// 4. Confidence Bar Component
// ============================================================

function ConfidenceBar({ confidence }) {
  const getColor = (conf) => {
    if (conf >= 90) return '#22c55e';
    if (conf >= 75) return '#84cc16';
    if (conf >= 60) return '#fbbf24';
    if (conf >= 40) return '#f97316';
    return '#ef4444';
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        marginBottom: '4px'
      }}>
        <span>Confidence</span>
        <span>{confidence}%</span>
      </div>
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: '#e5e7eb',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${confidence}%`,
          height: '100%',
          backgroundColor: getColor(confidence),
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  );
}


// ============================================================
// 5. Axios Example (Alternative)
// ============================================================

import axios from 'axios';

async function verifyClaimAxios(claimText) {
  try {
    const response = await axios.post('http://localhost:5000/api/analyze', {
      text: claimText
    });
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}


// ============================================================
// 6. Image Upload with Text
// ============================================================

async function verifyWithImage(claimText, imageFile) {
  const formData = new FormData();
  formData.append('text', claimText);
  formData.append('image', imageFile);

  try {
    const response = await fetch('http://localhost:5000/api/analyze', {
      method: 'POST',
      body: formData
      // Don't set Content-Type header - browser will set it with boundary
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
verifyWithImage("Is this image real?", file);


// ============================================================
// 7. TypeScript Types (Optional)
// ============================================================

interface AIAnalysis {
  key_facts: string[];
  red_flags: string[];
  sources_assessment: string;
}

interface Source {
  title: string;
  description: string;
  url: string;
  source: string;
}

interface VerificationResult {
  status: 'True' | 'Likely True' | 'Unverified' | 'Misleading' | 'Likely Fake' | 'Fake';
  result: 'Real' | 'Fake' | null;
  confidence: number;
  explanation: string;
  source_match: 'strong' | 'weak' | 'none';
  sources: Source[];
  source: string;
  ai_analysis?: AIAnalysis;
}


// ============================================================
// 8. Loading State Component
// ============================================================

function LoadingAnimation() {
  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <div className="spinner" />
      <p>Analyzing claim...</p>
      <p style={{ fontSize: '14px', color: '#6b7280' }}>
        Fetching news sources and running AI analysis
      </p>
    </div>
  );
}

// CSS for spinner
const spinnerCSS = `
  .spinner {
    border: 3px solid #f3f4f6;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;


// ============================================================
// 9. Error Handling Example
// ============================================================

async function robustVerifyClaim(claimText) {
  try {
    const response = await fetch('http://localhost:5000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: claimText })
    });

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error('Invalid input. Please provide a valid claim.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (response.status === 500) {
        throw new Error('Server error. Please try again.');
      } else {
        throw new Error(`Unexpected error: ${response.status}`);
      }
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Network error. Check your connection.');
    }
    throw error;
  }
}


// ============================================================
// 10. Complete Integration Example
// ============================================================

export default function FactChecker() {
  const [claim, setClaim] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleVerify = async () => {
    if (!claim.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: claim })
      });

      if (!response.ok) throw new Error('Verification failed');

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fact-checker">
      <h2>Fact Checker</h2>
      
      <div className="input-group">
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="Enter a claim to verify..."
          rows={4}
        />
        <button onClick={handleVerify} disabled={loading || !claim.trim()}>
          {loading ? 'Verifying...' : 'Verify Claim'}
        </button>
      </div>

      {loading && <LoadingAnimation />}
      {error && <div className="error">{error}</div>}
      
      {result && (
        <div className="result-card">
          <StatusBadge status={result.status} />
          <ConfidenceBar confidence={result.confidence} />
          
          <div className="explanation">
            <h3>Analysis</h3>
            <p>{result.explanation}</p>
          </div>

          {result.ai_analysis && (
            <div className="ai-details">
              {result.ai_analysis.key_facts.length > 0 && (
                <div className="key-facts">
                  <h4>✓ Key Facts</h4>
                  <ul>
                    {result.ai_analysis.key_facts.map((fact, i) => (
                      <li key={i}>{fact}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.ai_analysis.red_flags.length > 0 && (
                <div className="red-flags">
                  <h4>⚠ Red Flags</h4>
                  <ul>
                    {result.ai_analysis.red_flags.map((flag, i) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result.sources?.length > 0 && (
            <div className="sources">
              <h4>Sources</h4>
              {result.sources.map((source, i) => (
                <div key={i} className="source-item">
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                  </a>
                  <span className="source-name">{source.source}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
