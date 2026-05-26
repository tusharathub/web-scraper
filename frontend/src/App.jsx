import { useState } from 'react';
import './index.css';

const SELECTOR_OPTIONS = [
  { value: "h1, h2, h3, h4, h5, h6", label: "HEADINGS" },
  { value: "p", label: "PARAGRAPHS" },
  { value: "a", label: "LINKS (URLs)" },
  { value: "img", label: "IMAGES" },
  { value: "table", label: "TABLES" },
  { value: "ul, ol, li", label: "LISTS" }
];

function App() {
  const [url, setUrl] = useState('');
  const [selectors, setSelectors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleScrape = async (e) => {
    e.preventDefault(); 
    if (!url) return;

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('http://localhost:8000/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, selector: selectors.length > 0 ? selectors.map(s => s.value).join(', ') : null }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape the URL');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSelector = (e) => {
    const val = e.target.value;
    if (val && !selectors.some(s => s.value === val)) {
      const option = SELECTOR_OPTIONS.find(o => o.value === val);
      if (option) {
        setSelectors([...selectors, option]);
      }
    }
    e.target.value = ""; 
  };

  const removeSelector = (valToRemove) => {
    setSelectors(selectors.filter(s => s.value !== valToRemove));
  };

  return (
    <div className="app-container">
      <main>
        <div className="nav-item" style={{ position: 'absolute', top: '2rem', right: '2rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }} onClick={() => window.open('https://www.linkedin.com/in/tushar-nailwal/', '_blank')}>LET'S TALK!</div>
        <h1>
          WEB SCRAPE<br/>
          DATA AND<br/>
          EXTRACT
        </h1>

        <form className="form-container" onSubmit={handleScrape}>
          <div className="input-row">
            <input
              type="url"
              className="form-control"
              placeholder="TARGET URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <select
              className="form-control"
              defaultValue=""
              onChange={handleAddSelector}
            >
              <option value="" disabled>ADD SELECTOR...</option>
              {SELECTOR_OPTIONS.map((opt, i) => (
                <option key={i} value={opt.value} disabled={selectors.some(s => s.value === opt.value)}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          {selectors.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {selectors.map((sel, idx) => (
                <div key={idx} style={{ background: 'var(--text-main)', color: 'var(--bg-color)', padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {sel.label}
                  <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => removeSelector(sel.value)}>×</span>
                </div>
              ))}
            </div>
          )}
          <button type="submit" className="submit-btn" disabled={isLoading || !url}>
            {isLoading ? 'SCRAPING...' : 'EXTRACT DATA'}
          </button>
        </form>

        {error && <div className="error">{error}</div>}

        {results && (
          <div className="results-container">
            <div className="results-header">
              <span>RESULTS</span>
              <span>{results.elements ? results.elements.length : 0} ITEMS</span>
            </div>
            
            <div className="results-list">
              {results.elements && results.elements.length > 0 ? (
                results.elements.map((el, index) => (
                  <div key={index} className="element-item">
                    {el}
                  </div>
                ))
              ) : (
                <div>NO ELEMENTS FOUND.</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
