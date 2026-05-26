import { useState } from 'react';
import './index.css';

function App() {
  const [url, setUrl] = useState('');
  const [selector, setSelector] = useState('');
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
        body: JSON.stringify({ url, selector: selector || null }),
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

  return (
    <div className="app-container">
      <header>
        <div className="nav-item">DARK MODE</div>
        <div className="nav-item">MENU</div>
        <div className="nav-item">LET'S TALK!</div>
      </header>

      <main>
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
            <input
              type="text"
              className="form-control"
              placeholder="SELECTOR (OPTIONAL)"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
            />
          </div>
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
