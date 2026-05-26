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
      const API_URL = import.meta.env.VITE_API_URL || "";
      const response = await fetch(`${API_URL}/api/scrape`, {
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
    <div className="flex flex-col min-h-screen w-full">
      <main className="flex-1 flex flex-col items-center p-8 pt-4 md:pt-8 text-center min-h-min pb-10">
        <div 
          className="static self-end mb-8 md:absolute md:top-8 md:right-8 md:mb-0 md:self-auto text-[0.9rem] uppercase tracking-[0.1em] cursor-pointer hover:underline"
          onClick={() => window.open('https://www.linkedin.com/in/tushar-nailwal/', '_blank')}
        >
          LET'S TALK!
        </div>
        
        <h1 className="font-anton uppercase tracking-[-0.05em] mb-4 text-[clamp(3rem,12vw,3rem)] md:text-[clamp(4rem,15vw,12rem)] leading-[0.95]">
          WEB SCRAPE<br/>
          DATA AND<br/>
          EXTRACT
        </h1>

        <form className="w-full max-w-[800px] flex flex-col shrink-0 mb-16" onSubmit={handleScrape}>
          <div className="flex flex-col md:flex-row gap-4 shrink-0">
            <input
              type="url"
              className="flex-1 bg-transparent border-b-2 border-primary p-2 font-mono text-base text-primary outline-none placeholder-placeholder focus:outline-none"
              placeholder="TARGET URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <select
              className="flex-1 w-full md:w-auto bg-transparent border-b-2 border-primary p-2 font-mono text-base text-primary outline-none focus:outline-none"
              defaultValue=""
              onChange={handleAddSelector}
            >
              <option value="" disabled>ADD SELECTOR (DEFAULT EXTRACTS ALL)...</option>
              {SELECTOR_OPTIONS.map((opt, i) => (
                <option key={i} value={opt.value} disabled={selectors.some(s => s.value === opt.value)}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          {selectors.length > 0 && (
            <div className="flex gap-2 flex-wrap justify-center mt-4 shrink-0">
              {selectors.map((sel, idx) => (
                <div key={idx} className="bg-primary text-secondary py-1.5 px-3 text-sm flex items-center gap-2 rounded">
                  {sel.label}
                  <span className="cursor-pointer font-bold" onClick={() => removeSelector(sel.value)}>×</span>
                </div>
              ))}
            </div>
          )}
          
          <button type="submit" className="w-full bg-primary text-secondary px-8 py-4 font-mono text-base uppercase cursor-pointer mt-4 transition-opacity duration-200 hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed shrink-0" disabled={isLoading || !url}>
            {isLoading ? 'SCRAPING...' : 'EXTRACT DATA'}
          </button>
        </form>

        {error && <div className="text-red-500 mt-4 text-[0.9rem]">{error}</div>}

        {results && (
          <div className="mt-16 w-full max-w-[800px] text-left">
            <div className="flex justify-between border-b-2 border-primary pb-2 mb-6 uppercase">
              <span>RESULTS</span>
              <span>{results.elements ? results.elements.length : 0} ITEMS</span>
            </div>
            
            <div className="results-list">
              {results.elements && results.elements.length > 0 ? (
                results.elements.map((el, index) => (
                  <div key={index} className="mb-4 pb-4 border-b border-border break-words">
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
