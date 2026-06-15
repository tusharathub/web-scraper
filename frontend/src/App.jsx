import { useState, useRef, useEffect } from 'react';
import './index.css';

const PRESET_SELECTORS = [
  { value: "h1, h2, h3, h4, h5, h6", label: "Headings" },
  { value: "p", label: "Paragraphs" },
  { value: "a", label: "Links (URLs)" },
  { value: "img", label: "Images" },
  { value: "table", label: "Tables" },
  { value: "ul, ol, li", label: "Lists" }
];

const STEPS = [
  { name: "EXTRACT", desc: "Ingest Web Content" },
  { name: "CLEAN", desc: "Deduplicate & Clean" },
  { name: "STORE", desc: "Local JSON/CSV Storage" },
  { name: "ANALYZE", desc: "Llama AI Evaluation" },
  { name: "REPORT", desc: "Dossier Ingest" }
];

// Helper to format timestamps nicely
const formatTime = (isoString) => {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
};

// Helper to format bytes
const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

function App() {
  // Scraper Settings
  const [url, setUrl] = useState('');
  const [selectors, setSelectors] = useState([]);
  const [customSelector, setCustomSelector] = useState('');

  // Cleaning Settings
  const [lowercase, setLowercase] = useState(false);
  const [removePunctuation, setRemovePunctuation] = useState(false);
  const [normalizeWhitespace, setNormalizeWhitespace] = useState(true);
  const [removeStopwords, setRemoveStopwords] = useState(false);
  const [minLineLength, setMinLineLength] = useState(0);
  const [deduplicate, setDeduplicate] = useState(true);

  // AI Settings
  const [runAi, setRunAi] = useState(true);
  const [aiModel, setAiModel] = useState('llama-3.1-8b-instant');

  // Job and UI State
  const [isLoading, setIsLoading] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [currentTab, setCurrentTab] = useState('metrics');
  const [dataViewMode, setDataViewMode] = useState('cleaned'); // 'raw' or 'cleaned'
  const [error, setError] = useState(null);
  const [apiOnline, setApiOnline] = useState(true);

  // Stepper & Logging State
  const [activeStep, setActiveStep] = useState(0);
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);

  // Llama Chat State
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const consoleEndRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // Check backend server status
  const checkApiStatus = async () => {
    try {
      await fetch(`${API_URL}/api/pipeline/run`, { method: 'GET' });
      setApiOnline(true);
    } catch (err) {
      setApiOnline(false);
    }
  };

  useEffect(() => {
    checkApiStatus();
  }, []);

  // Scroll to bottom of terminal console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Add selector from preset dropdown
  const handleSelectPreset = (e) => {
    const val = e.target.value;
    if (val && !selectors.includes(val)) {
      setSelectors([...selectors, val]);
    }
    e.target.value = "";
  };

  // Add custom typed selector
  const handleAddCustomSelector = (e) => {
    e.preventDefault();
    const val = customSelector.trim();
    if (val && !selectors.includes(val)) {
      setSelectors([...selectors, val]);
      setCustomSelector('');
    }
  };

  // Remove active selector
  const removeSelector = (sel) => {
    setSelectors(selectors.filter(s => s !== sel));
  };

  // Run new pipeline run
  const handleRunPipeline = async (e) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setActiveStep(0);
    setError(null);
    setActiveJob(null);
    setChatHistory([]);
    setCurrentTab('metrics');

    const initialLogs = [
      `[${new Date().toISOString()}] Initializing ETL Pipeline Run...`,
      `[${new Date().toISOString()}] Target URL: ${url}`,
      `[${new Date().toISOString()}] Active Selectors: ${selectors.length > 0 ? selectors.join(', ') : 'Default (headings & paragraphs)'}`
    ];
    setLogs(initialLogs);

    const addLog = (msg) => {
      setLogs(prev => [...prev, `[${new Date().toISOString()}] ${msg}`]);
    };

    // Simulated progress timings to show UI stepper changes
    const timers = [];

    timers.push(setTimeout(() => {
      setActiveStep(1);
      addLog("Extract: Connection established. Scraped HTML parsed with BeautifulSoup.");
      addLog("Clean: Starting Data Cleaning Ingestion module...");
    }, 1200));

    timers.push(setTimeout(() => {
      setActiveStep(2);
      addLog("Clean: Normalizing whitespace and removing rule exclusions.");
      addLog("Store: Database transaction queued. Saving data locally to backend data index...");
    }, 2400));

    timers.push(setTimeout(() => {
      setActiveStep(3);
      addLog("Store: Saved JSON file successfully inside backend/data/.");
      if (runAi) {
        addLog(`Analyze: Routing context window payload to Groq LLM API (${aiModel})...`);
      } else {
        addLog("Analyze: Skipping Groq Llama analysis (disabled in config).");
      }
    }, 3600));

    timers.push(setTimeout(() => {
      setActiveStep(4);
      addLog("Report: Compiling ETL executive report...");
    }, 5000));

    try {
      const res = await fetch(`${API_URL}/api/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          selectors: selectors.length > 0 ? selectors : null,
          cleaning: {
            lowercase,
            remove_punctuation: removePunctuation,
            normalize_whitespace: normalizeWhitespace,
            remove_stopwords: removeStopwords,
            min_line_length: parseInt(minLineLength) || 0,
            deduplicate
          },
          analysis: {
            run_ai: runAi,
            model: aiModel
          }
        })
      });

      // Clear simulated timers
      timers.forEach(t => clearTimeout(t));

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to complete pipeline job run.');
      }

      setActiveStep(5); // Completed successfully
      setActiveJob(data);
      setLogs(data.logs || []);
      fetchJobsList();
    } catch (err) {
      timers.forEach(t => clearTimeout(t));
      setError(err.message);
      setActiveStep(-1); // Failed
      addLog(`CRITICAL PIPELINE ERROR: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Direct trigger download helper in browser memory
  const handleDownload = (format) => {
    if (!activeJob) return;
    let blob, filename;

    if (format === 'json') {
      blob = new Blob([JSON.stringify(activeJob.cleaned_elements, null, 2)], { type: 'application/json;charset=utf-8;' });
      filename = `pipeline_data_${activeJob.meta.job_id}.json`;
    } else if (format === 'csv') {
      const headers = "index,content\n";
      const rows = activeJob.cleaned_elements.map((el, idx) => {
        const escaped = el.replace(/"/g, '""');
        return `${idx + 1},"${escaped}"`;
      }).join("\n");
      blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      filename = `pipeline_data_${activeJob.meta.job_id}.csv`;
    } else if (format === 'report') {
      blob = new Blob([activeJob.report_markdown], { type: 'text/markdown;charset=utf-8;' });
      filename = `pipeline_report_${activeJob.meta.job_id}.md`;
    }

    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Chat with Llama about job data statelessly
  const handleSendJobChatMessage = async (e, customPrompt = null) => {
    if (e) e.preventDefault();
    const promptToSend = customPrompt || chatInput.trim();
    if (!promptToSend || !activeJob?.meta.job_id) return;

    if (!customPrompt) setChatInput('');
    setIsChatLoading(true);

    const userMsg = { role: 'user', content: promptToSend };
    setChatHistory(prev => [...prev, userMsg]);

    try {
      const res = await fetch(`${API_URL}/api/pipeline/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: activeJob.cleaned_elements,
          prompt: promptToSend,
          model: aiModel
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to get Llama chat response');
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'system', content: `Error: ${err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Copy Markdown to Clipboard
  const handleCopyReport = () => {
    if (!activeJob?.report_markdown) return;
    navigator.clipboard.writeText(activeJob.report_markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safe markdown regex table parser
  const parseMarkdownTables = (text) => {
    if (!text) return "";
    const lines = text.split('\n');
    let inTable = false;
    let tableRows = [];
    const processedLines = [];

    const buildTableHtml = (rows) => {
      const dataRows = rows.filter(row => !row.match(/^\|\s*:?-+:?\s*\|/));
      if (dataRows.length === 0) return "";

      const parseRow = (row) => {
        return row.split('|')
          .slice(1, -1)
          .map(cell => cell.trim());
      };

      const headers = parseRow(dataRows[0]);
      const bodyRows = dataRows.slice(1).map(parseRow);

      const headerHtml = `<thead><tr class="bg-primary text-white font-bold border-b-2 border-primary">
        ${headers.map(h => `<th class="p-2 text-left text-xs uppercase font-bold tracking-wider">${h}</th>`).join('')}
      </tr></thead>`;

      const bodyHtml = `<tbody>
        ${bodyRows.map(row => `<tr class="border-b border-primary/20 hover:bg-neo-yellow/5">
          ${row.map(cell => `<td class="p-2 text-xs font-mono">${cell}</td>`).join('')}
        </tr>`).join('')}
      </tbody>`;

      return `<div class="overflow-x-auto border-4 border-primary my-4 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"><table class="w-full text-left border-collapse bg-white">${headerHtml}${bodyHtml}</table></div>`;
    };

    for (let line of lines) {
      if (line.trim().startsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        tableRows.push(line);
      } else {
        if (inTable) {
          inTable = false;
          processedLines.push(buildTableHtml(tableRows));
        }
        processedLines.push(line);
      }
    }
    if (inTable) {
      processedLines.push(buildTableHtml(tableRows));
    }
    return processedLines.join('\n');
  };

  // Custom regex markdown compiler
  const renderMarkdown = (md) => {
    if (!md) return "";

    // Ingest tables
    let html = parseMarkdownTables(md);

    // Headers
    html = html.replace(/^# (.*?)$/gm, '<h1 class="text-xl md:text-2xl font-anton uppercase border-b-4 border-primary pb-2 my-4 text-primary">$1</h1>');
    html = html.replace(/^## (.*?)$/gm, '<h2 class="text-lg md:text-xl font-bold uppercase my-3 border-b-2 border-primary pb-1 text-primary">$1</h2>');
    html = html.replace(/^### (.*?)$/gm, '<h3 class="text-base md:text-lg font-bold uppercase my-2 text-primary">$1</h3>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Code blocks / inline code
    html = html.replace(/`(.*?)`/g, '<code class="bg-primary text-neo-yellow px-1.5 py-0.5 text-xs font-mono font-bold">$1</code>');

    // Lists
    html = html.replace(/^- (.*?)$/gm, '<li class="list-disc ml-6 my-1.5 text-xs md:text-sm">$1</li>');

    // HR
    html = html.replace(/^---$/gm, '<hr class="border-2 border-primary my-4" />');

    // Paragraphs
    const lines = html.split('\n');
    const resultLines = lines.map(line => {
      const t = line.trim();
      if (t.startsWith('<') || t.startsWith('</') || t === '' || t.startsWith('^') || t.startsWith('|') || t.startsWith('-')) {
        return line;
      }
      return `<p class="my-2 text-xs md:text-sm leading-relaxed">${line}</p>`;
    });

    return resultLines.join('\n');
  };

  // Helper percentage reduction calculation
  const getReductionPercent = () => {
    if (!activeJob) return 0;
    const raw = activeJob.meta.raw_size_bytes;
    const clean = activeJob.meta.clean_size_bytes;
    if (raw === 0) return 0;
    return Math.round((1 - (clean / raw)) * 100);
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary w-full text-primary font-mono select-text">

      {/* Title Header */}
      <header className="border-b-4 border-primary bg-white p-6 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-[0_4px_0_0_rgba(26,26,26,1)]">
        <div>
          <h1 className="font-anton text-2xl md:text-4xl tracking-tight uppercase leading-none">
            DATAPULSE // ETL ENGINE
          </h1>
          <p className="text-xs uppercase font-semibold text-primary/70 tracking-widest mt-1">
            Data extraction, transformation, storage & Llama AI analysis
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-primary font-bold text-xs uppercase ${apiOnline ? 'bg-neo-green text-black' : 'bg-neo-pink text-white animate-pulse'}`}>
            <span className="w-2 h-2 bg-current rounded-full inline-block"></span>
            {apiOnline ? 'API ONLINE' : 'API OFFLINE'}
          </div>
          <div
            className="border-2 border-primary bg-white text-black font-bold py-1.5 px-3 text-xs uppercase tracking-wider cursor-pointer hover:bg-neo-yellow active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] transition-all"
            onClick={() => window.open('https://www.linkedin.com/in/tushar-nailwal/', '_blank')}
          >
            LET'S TALK!
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="flex-1 w-full max-w-[1500px] mx-auto p-4 md:p-6 grid grid-cols-12 gap-6 min-h-0">

        {/* Left Column: Configuration Ingest */}
        <section className="col-span-12 md:col-span-5 lg:col-span-4 flex flex-col gap-6">
          <div className="neo-card p-6 flex flex-col gap-5 bg-white">
            <h2 className="font-anton text-xl tracking-wide uppercase border-b-2 border-primary pb-2 flex items-center gap-2">
              <span>⚙️</span> PIPELINE CONFIG
            </h2>

            <form onSubmit={handleRunPipeline} className="flex flex-col gap-4">

              {/* Step 1: Extract (Scraper URL) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider">1. Ingest URL</label>
                <input
                  type="url"
                  className="neo-input w-full"
                  placeholder="https://example.com/target-page"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Selectors */}
              <div className="flex flex-col gap-1.5 border-t-2 border-primary/10 pt-3">
                <label className="text-xs font-bold uppercase tracking-wider">2. Document Selectors</label>
                <div className="flex gap-2">
                  <select
                    className="neo-input flex-1 py-2 text-xs"
                    onChange={handleSelectPreset}
                    defaultValue=""
                    disabled={isLoading}
                  >
                    <option value="" disabled>Add Preset Selector...</option>
                    {PRESET_SELECTORS.map((opt, i) => (
                      <option key={i} value={opt.value} disabled={selectors.includes(opt.value)}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Custom CSS Selectors Form */}
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    className="neo-input flex-1 py-1.5 text-xs font-mono"
                    placeholder="Custom CSS e.g. div.article"
                    value={customSelector}
                    onChange={(e) => setCustomSelector(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSelector}
                    className="neo-btn py-1.5 px-3 text-xs bg-white"
                    disabled={isLoading || !customSelector.trim()}
                  >
                    Add
                  </button>
                </div>

                {/* Tags lists */}
                {selectors.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2 bg-secondary p-2 border-2 border-primary/20 max-h-24 overflow-y-auto">
                    {selectors.map((sel, idx) => (
                      <div key={idx} className="bg-primary text-secondary py-0.5 px-2 text-[10px] flex items-center gap-1.5 font-bold uppercase">
                        <span className="truncate max-w-[150px]">{sel}</span>
                        <span className="cursor-pointer text-neo-pink hover:text-white text-xs font-bold" onClick={() => removeSelector(sel)}>×</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-primary/50 italic mt-1">
                    * No selectors defined. Defaulting to all headings and paragraphs.
                  </p>
                )}
              </div>

              {/* Step 4: AI Analysis Settings */}
              <div className="flex flex-col gap-2 border-t-2 border-primary/10 pt-3">
                <label className="text-xs font-bold uppercase tracking-wider">3. Llama 3 AI Analysis</label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold select-none border-2 border-primary p-2 bg-white hover:bg-neo-yellow/10">
                  <input
                    type="checkbox"
                    checked={runAi}
                    onChange={(e) => setRunAi(e.target.checked)}
                    disabled={isLoading}
                    className="accent-primary w-4 h-4 cursor-pointer"
                  />
                  Run Groq AI insights
                </label>
              </div>

              {/* Trigger Ingestion button */}
              <button
                type="submit"
                className="neo-btn-primary w-full py-4 mt-2 text-base shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] font-bold tracking-wider"
                disabled={isLoading || !url}
              >
                {isLoading ? 'EXECUTING PIPELINE...' : 'RUN PIPELINE ⚡'}
              </button>

            </form>
          </div>
        </section>

        {/* Right Column: Workstation Dashboard */}
        <section className="col-span-12 md:col-span-7 lg:col-span-8 flex flex-col gap-6 min-h-0">

          {/* Main workspace displays */}
          {!isLoading && !activeJob ? (
            /* CASE A: No Active Job - Show Welcome instructions */
            <div className="flex flex-col gap-6 min-h-0 flex-1">

              {/* Splash Panel */}
              <div className="neo-card p-8 bg-neo-yellow/20 flex flex-col gap-4 border-dashed border-4 border-primary">
                <h2 className="font-anton text-2xl md:text-3xl uppercase tracking-tight text-primary leading-none">
                  READY FOR ETL INGESTION
                </h2>
                <p className="text-xs md:text-sm leading-relaxed text-primary/80 max-w-2xl">
                  Configure your target URL and data transformations, then press "Run Pipeline". The system will scrape, clean, run advanced LLM analytics via Groq, and compile an audit dossier.
                </p>
                <div className="flex flex-wrap gap-3 mt-1">
                  <div className="bg-white border-2 border-primary py-1 px-3 text-[11px] font-bold">1. EXTRACTION</div>
                  <div className="bg-white border-2 border-primary py-1 px-3 text-[11px] font-bold">2. TRANSFORMATION</div>
                  <div className="bg-white border-2 border-primary py-1 px-3 text-[11px] font-bold">3. PERSISTENCE</div>
                  <div className="bg-white border-2 border-primary py-1 px-3 text-[11px] font-bold">4. COGNITION</div>
                </div>
              </div>

              {/* Ingestion Sandbox Guide */}
              <div className="neo-card p-8 flex flex-col gap-4 flex-1 bg-white justify-center items-center text-center border-4 border-primary">
                <span className="text-5xl">📊</span>
                <h3 className="font-anton text-2xl uppercase tracking-wider text-primary">STATELESS ETL INGESTION WORKSPACE</h3>
                <p className="text-xs md:text-sm text-primary/60 max-w-md leading-relaxed font-mono">
                  This workstation runs completely in memory. All scraped text is processed on-the-fly and returned instantly. Files can be generated and downloaded directly to your computer.
                </p>
                <div className="flex gap-4 text-xs font-bold mt-2">
                  <span className="bg-secondary px-3 py-1.5 border-2 border-primary">🔒 SECURE // NO COOKIES</span>
                  <span className="bg-secondary px-3 py-1.5 border-2 border-primary">⚡ HIGH SPEED</span>
                </div>
              </div>

            </div>
          ) : isLoading && !activeJob ? (
            /* CASE B: Loading Pipeline Execution (Simulated Stepper + Console Logs) */
            <div className="flex flex-col gap-6 flex-1 min-h-0">

              {/* Stepper Status */}
              <div className="neo-card p-6 bg-white flex flex-col gap-4">
                <h3 className="font-anton text-lg tracking-wider uppercase border-b-2 border-primary pb-2 flex items-center gap-2">
                  <span>⚡</span> ETL INGUEST PIPELINE IN PROGRESS
                </h3>

                <div className="flex flex-col gap-4 mt-2">
                  {STEPS.map((step, idx) => {
                    let stepStatus = "idle";
                    if (activeStep > idx) stepStatus = "completed";
                    else if (activeStep === idx) stepStatus = "running";

                    return (
                      <div key={idx} className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center font-bold text-xs transition-all ${stepStatus === "completed" ? 'bg-neo-green text-black' :
                          stepStatus === "running" ? 'bg-neo-yellow animate-pulse-green' : 'bg-white text-primary/40'
                          }`}>
                          {stepStatus === "completed" ? "✓" : idx + 1}
                        </div>
                        <div>
                          <div className={`text-xs font-bold uppercase ${stepStatus === "running" ? 'text-primary' : stepStatus === "completed" ? 'text-primary/70' : 'text-primary/40'}`}>
                            {step.name}
                          </div>
                          <div className="text-[10px] text-primary/50">{step.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Logs console */}
              <div className="neo-card flex-1 flex flex-col min-h-[250px] bg-primary border-4 border-primary shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
                <div className="bg-primary text-white px-4 py-2 border-b-2 border-primary/20 flex justify-between items-center text-xs font-bold shrink-0">
                  <span>TERMINAL LOGS CONSOLE</span>
                  <span className="text-[10px] text-neo-green animate-pulse">● LIVE STREAM</span>
                </div>
                <div className="console-log flex-1 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div key={index} className="mb-1 text-[11px] font-mono break-all leading-normal whitespace-pre-wrap">
                      {log}
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              </div>

            </div>
          ) : (
            /* CASE C: Active Job Workspace Render */
            <div className="flex flex-col gap-6 flex-1 min-h-0">

              {/* Back to history bar */}
              <div className="flex justify-between items-center bg-white border-4 border-primary p-4 shadow-[4px_4px_0_0_rgba(26,26,26,1)] shrink-0">
                <div className="flex flex-col max-w-[70%]">
                  <span className="text-[10px] font-bold text-primary/60 uppercase">Ingestion Target Dossier</span>
                  <span className="text-xs font-bold truncate underline text-primary">{activeJob.meta.url}</span>
                </div>
                <button
                  onClick={() => { setActiveJob(null); }}
                  className="neo-btn-secondary py-1.5 px-4 text-xs font-bold"
                >
                  ← BACK TO INDEX
                </button>
              </div>

              {/* Stepper Status Indicators */}
              {/* <div className="neo-card p-4 bg-white shrink-0 grid grid-cols-5 gap-2 text-center text-[10px] font-bold uppercase">
                {STEPS.map((step, idx) => {
                  const isCompleted = activeStep === 5 || activeStep > idx;
                  const isFailed = activeStep === -1 && idx === 4; // Mock Llama/report failing case

                  return (
                    <div key={idx} className={`p-2 border-2 ${isCompleted ? 'border-primary bg-neo-green/10 text-primary' :
                      isFailed ? 'border-neo-pink bg-neo-pink/10 text-neo-pink' : 'border-primary/20 text-primary/40'
                      }`}>
                      <div className="text-xs mb-0.5">{isCompleted ? "✓" : isFailed ? "✗" : idx + 1}</div>
                      <div className="truncate">{step.name}</div>
                    </div>
                  );
                })}
              </div> */}

              {/* Workspace Tab Headers */}
              <div className="flex border-b-4 border-primary select-none shrink-0 bg-white shadow-[4px_4px_0_0_rgba(26,26,26,1)]">
                {['metrics', 'data', 'ai', 'report', 'logs'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCurrentTab(tab)}
                    className={`flex-1 py-3 px-1 text-center font-bold text-xs uppercase cursor-pointer border-r-2 last:border-r-0 border-primary transition-all ${currentTab === tab ? 'bg-neo-yellow text-primary font-black' : 'bg-white hover:bg-gray-50'
                      }`}
                  >
                    {tab === 'report' ? '📂 Dossier' : tab === 'ai' ? '🤖 AI Llama' : tab === 'data' ? '📋 Data Comparator' : tab}
                  </button>
                ))}
              </div>

              {/* Tab Display Panel */}
              <div className="neo-card p-6 bg-white flex-1 overflow-y-auto min-h-[300px]">

                {/* Error Banner inside workspace if job failed */}
                {activeJob.meta.status === "failed" && (
                  <div className="bg-neo-pink/10 border-4 border-neo-pink text-neo-pink p-4 mb-4 font-bold text-xs uppercase">
                    ⚠️ Pipeline Execution Failed: {activeJob.meta.error}
                  </div>
                )}

                {/* TAB 1: METRICS PANEL */}
                {currentTab === 'metrics' && (
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                      {/* Metric Card 1: Data Reduction */}
                      <div className="border-4 border-primary p-4 bg-white shadow-[2px_2px_0_0_rgba(26,26,26,1)] flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-primary/60 uppercase">Data Ingestion Size</span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-2xl font-black text-primary">{formatBytes(activeJob.meta.clean_size_bytes)}</span>
                          <span className="text-xs text-primary/50 line-through">{formatBytes(activeJob.meta.raw_size_bytes)}</span>
                        </div>
                        {activeJob.meta.status === "completed" && (
                          <div className="mt-1 w-full bg-secondary border border-primary/20 h-4 relative">
                            <div
                              className="bg-neo-green border-r border-primary h-full"
                              style={{ width: `${Math.max(5, 100 - getReductionPercent())}%` }}
                            ></div>
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
                              -{getReductionPercent()}% Reduction
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Metric Card 2: Element volume */}
                      <div className="border-4 border-primary p-4 bg-white shadow-[2px_2px_0_0_rgba(26,26,26,1)] flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-primary/60 uppercase">Elements Processed</span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-2xl font-black text-primary">{activeJob.meta.items_cleaned}</span>
                          <span className="text-xs text-primary/50">/ {activeJob.meta.items_scraped} raw</span>
                        </div>
                        <span className="text-[10px] text-primary/60 font-semibold italic mt-1">
                          {activeJob.meta.items_scraped - activeJob.meta.items_cleaned} elements filtered out
                        </span>
                      </div>

                      {/* Metric Card 3: Ingestion Speeds */}
                      <div className="border-4 border-primary p-4 bg-white shadow-[2px_2px_0_0_rgba(26,26,26,1)] flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-primary/60 uppercase">Pipeline Duration</span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-2xl font-black text-primary">{activeJob.meta.duration_ms?.toFixed(0) || 0}</span>
                          <span className="text-xs text-primary/50">ms total</span>
                        </div>
                        <span className="text-[10px] text-primary/60 font-semibold italic mt-1">
                          Calculated from connection to report output
                        </span>
                      </div>

                      {/* Metric Card 4: Word count */}
                      <div className="border-4 border-primary p-4 bg-white shadow-[2px_2px_0_0_rgba(26,26,26,1)] flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-primary/60 uppercase">Dataset Word Volume</span>
                        <span className="text-2xl font-black text-primary mt-1">{activeJob.meta.word_count || 0}</span>
                        <span className="text-[10px] text-primary/60 font-semibold italic">
                          Estimated reading time: {activeJob.meta.estimated_read_time_sec || 0} seconds
                        </span>
                      </div>

                      {/* Metric Card 5: Sentences count */}
                      <div className="border-4 border-primary p-4 bg-white shadow-[2px_2px_0_0_rgba(26,26,26,1)] flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-primary/60 uppercase">Dataset Sentences</span>
                        <span className="text-2xl font-black text-primary mt-1">{activeJob.meta.sentence_count || 0}</span>
                        <span className="text-[10px] text-primary/60 font-semibold italic">
                          Average sentence length: {activeJob.meta.sentence_count > 0 ? Math.round(activeJob.meta.word_count / activeJob.meta.sentence_count) : 0} words
                        </span>
                      </div>

                      {/* Metric Card 6: AI Ingestion */}
                      <div className="border-4 border-primary p-4 bg-white shadow-[2px_2px_0_0_rgba(26,26,26,1)] flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-primary/60 uppercase">LLM Cognition status</span>
                        <span className={`text-sm font-bold uppercase mt-2 px-2 py-1 inline-block border-2 border-primary text-center ${activeJob.meta.has_ai_analysis ? 'bg-neo-orange text-white' : 'bg-secondary text-primary/40'}`}>
                          {activeJob.meta.has_ai_analysis ? 'ACTIVE // LLAMA 3' : 'INACTIVE'}
                        </span>
                      </div>
                    </div>

                    {/* Metadata specs table */}
                    <div className="border-4 border-primary p-4 bg-secondary/20 mt-2">
                      <h4 className="font-bold text-xs uppercase border-b border-primary/20 pb-1 mb-2">ETL Run Specifications</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                        <div>Job ID: <strong className="font-mono">JOB_{activeJob.meta.job_id}</strong></div>
                        <div>Date: <strong className="font-mono">{formatTime(activeJob.meta.timestamp)}</strong></div>
                        <div>Ingested URL: <span className="font-mono truncate inline-block max-w-[250px] align-bottom text-primary underline">{activeJob.meta.url}</span></div>
                        <div>Selectors: <strong className="font-mono">{activeJob.meta.selectors.length > 0 ? activeJob.meta.selectors.join(', ') : 'Default'}</strong></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: DATA COMPARATOR PANEL */}
                {currentTab === 'data' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center border-b-2 border-primary pb-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDataViewMode('cleaned')}
                          className={`px-3 py-1 text-xs font-bold uppercase border-2 border-primary cursor-pointer transition-all ${dataViewMode === 'cleaned' ? 'bg-neo-green text-black' : 'bg-white'}`}
                        >
                          Cleaned Elements ({activeJob.cleaned_elements?.length || 0})
                        </button>
                        <button
                          onClick={() => setDataViewMode('raw')}
                          className={`px-3 py-1 text-xs font-bold uppercase border-2 border-primary cursor-pointer transition-all ${dataViewMode === 'raw' ? 'bg-neo-pink text-white' : 'bg-white'}`}
                        >
                          Raw Elements ({activeJob.raw_elements?.length || 0})
                        </button>
                      </div>
                      <span className="text-[10px] text-primary/50 font-bold uppercase">
                        Viewing {dataViewMode} mode
                      </span>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto border-4 border-primary p-4 bg-secondary/10 flex flex-col gap-2">
                      {dataViewMode === 'cleaned' ? (
                        activeJob.cleaned_elements && activeJob.cleaned_elements.length > 0 ? (
                          activeJob.cleaned_elements.map((el, idx) => (
                            <div key={idx} className="p-3 bg-white border border-primary/20 text-xs font-mono break-words leading-relaxed shadow-[2px_2px_0px_0px_rgba(26,26,26,0.1)]">
                              <span className="text-[9px] font-bold text-primary/40 mr-2">[{idx + 1}]</span>
                              {el}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-12 text-primary/50 text-xs uppercase">No elements extracted after cleaning criteria.</div>
                        )
                      ) : (
                        activeJob.raw_elements && activeJob.raw_elements.length > 0 ? (
                          activeJob.raw_elements.map((el, idx) => (
                            <div key={idx} className="p-3 bg-white border border-primary/20 text-xs font-mono break-words leading-relaxed opacity-80">
                              <span className="text-[9px] font-bold text-primary/40 mr-2">[{idx + 1}]</span>
                              {el}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-12 text-primary/50 text-xs uppercase">No raw elements extracted.</div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: AI INSIGHTS PANEL */}
                {currentTab === 'ai' && (
                  <div className="flex flex-col gap-6">
                    {/* Render Static AI insights if executed */}
                    {activeJob.meta.has_ai_analysis ? (
                      <div className="flex flex-col gap-5">
                        {/* Summary Block */}
                        <div className="border-4 border-primary p-5 bg-neo-yellow/10 shadow-[3px_3px_0_0_rgba(26,26,26,1)] flex flex-col gap-2">
                          <h4 className="font-anton text-sm uppercase tracking-wider text-neo-orange">Llama 3 // Executive Summary</h4>
                          <p className="text-xs md:text-sm leading-relaxed mt-1 font-mono font-semibold">
                            {activeJob.meta.ai_summary}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Sentiment */}
                          <div className="border-4 border-primary p-5 bg-white shadow-[3px_3px_0_0_rgba(26,26,26,1)] flex flex-col gap-3">
                            <h4 className="font-anton text-xs uppercase tracking-wider">Cognitive Sentiment Profiling</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className={`px-3 py-1 border-2 border-primary font-bold text-xs uppercase ${activeJob.meta.ai_sentiment_score > 0.1 ? 'bg-neo-green text-black' :
                                activeJob.meta.ai_sentiment_score < -0.1 ? 'bg-neo-pink text-white' : 'bg-neo-yellow text-primary'
                                }`}>
                                {activeJob.meta.ai_sentiment || 'Neutral'}
                              </span>
                              <span className="text-xs font-bold text-primary/60">
                                Score: {activeJob.meta.ai_sentiment_score?.toFixed(2) || '0.00'}
                              </span>
                            </div>

                            {/* Meter bar */}
                            {activeJob.meta.ai_sentiment_score !== null && (
                              <div className="mt-2 w-full bg-secondary border-2 border-primary h-5 relative flex overflow-hidden">
                                <div className="flex-1 bg-secondary border-r border-primary/20 flex items-center justify-end pr-1 text-[8px] text-primary/40 font-bold">-1.0</div>
                                <div className="flex-1 bg-secondary flex items-center pl-1 text-[8px] text-primary/40 font-bold">+1.0</div>
                                <div
                                  className="absolute top-0 bottom-0 w-2.5 bg-primary border border-white"
                                  style={{ left: `calc(${((activeJob.meta.ai_sentiment_score + 1) / 2) * 100}% - 5px)` }}
                                ></div>
                              </div>
                            )}
                          </div>

                          {/* Key Topics */}
                          <div className="border-4 border-primary p-5 bg-white shadow-[3px_3px_0_0_rgba(26,26,26,1)] flex flex-col gap-3">
                            <h4 className="font-anton text-xs uppercase tracking-wider">Category Themes (Max 5)</h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {activeJob.meta.ai_topics && activeJob.meta.ai_topics.length > 0 ? (
                                activeJob.meta.ai_topics.map((t, idx) => (
                                  <span key={idx} className="bg-primary text-secondary py-1 px-3 text-[10px] font-bold uppercase tracking-wider border border-primary">
                                    #{t}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-primary/40 italic">No topics identified.</span>
                              )}
                            </div>
                          </div>

                          {/* Named Entities */}
                          <div className="col-span-1 md:col-span-2 border-4 border-primary p-5 bg-white shadow-[3px_3px_0_0_rgba(26,26,26,1)] flex flex-col gap-3">
                            <h4 className="font-anton text-xs uppercase tracking-wider">Extracted Named Entities (NER)</h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {activeJob.meta.ai_entities && activeJob.meta.ai_entities.length > 0 ? (
                                activeJob.meta.ai_entities.map((ent, idx) => (
                                  <span key={idx} className="bg-neo-blue text-primary py-1 px-3 text-[10px] font-bold uppercase border-2 border-primary shadow-[1px_1px_0_0_rgba(26,26,26,1)]">
                                    🔍 {ent}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-primary/40 italic">No entities extracted.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border-4 border-primary p-6 text-center bg-secondary/15 flex flex-col items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        <p className="text-xs font-bold uppercase tracking-wider">Static AI Ingestion Skipped</p>
                        <p className="text-[10px] text-primary/60 max-w-md">
                          Ingestion analysis was skipped. However, you can still query Llama interactively below.
                        </p>
                      </div>
                    )}

                    {/* Llama 3 Interactive Chat Terminal */}
                    <div className="border-4 border-primary p-5 bg-white shadow-[3px_3px_0_0_rgba(26,26,26,1)] flex flex-col gap-4 mt-2">
                      <h4 className="font-anton text-sm uppercase tracking-wider text-neo-orange bg-primary/5 border border-primary p-2 flex justify-between items-center">
                        <span>💬 INTERACTIVE LLAMA COGNITION TERMINAL</span>
                        <span className="text-[9px] font-mono font-bold bg-primary text-white px-2 py-0.5">{aiModel.toUpperCase()}</span>
                      </h4>

                      {/* Chat messages */}
                      <div className="border-2 border-primary bg-secondary/20 p-4 h-60 overflow-y-auto flex flex-col gap-3 font-mono text-xs">
                        {chatHistory.length === 0 ? (
                          <div className="text-center text-primary/40 py-12 italic">
                            Terminal initialized. Submit queries relating to this scraped dataset.
                          </div>
                        ) : (
                          chatHistory.map((msg, idx) => (
                            <div key={idx} className={`p-3 border-2 border-primary ${msg.role === 'user' ? 'bg-neo-yellow/15 self-end max-w-[85%]' : msg.role === 'system' ? 'bg-neo-pink/15 text-neo-pink self-center text-center' : 'bg-white self-start max-w-[85%]'}`}>
                              <div className="font-bold text-[9px] uppercase text-primary/50 mb-1">
                                {msg.role === 'user' ? '👤 USER' : msg.role === 'system' ? '⚠️ ERROR' : '🤖 LLAMA'}
                              </div>
                              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                            </div>
                          ))
                        )}
                        {isChatLoading && (
                          <div className="bg-primary/5 p-3 border-2 border-dashed border-primary self-start max-w-[85%] animate-pulse">
                            <div className="font-bold text-[9px] uppercase text-primary/50 mb-1">🤖 LLAMA</div>
                            <span className="italic">Generating inference response...</span>
                          </div>
                        )}
                      </div>

                      {/* Prompt suggestions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-primary/50">Quick Queries:</span>
                        {[
                          "Summarize top 3 takeaways",
                          "List key action items",
                          "Identify target audience",
                          "Draft a summary tweet"
                        ].map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendJobChatMessage(null, q)}
                            disabled={isChatLoading}
                            className="text-[9px] uppercase border border-primary px-2 py-1 bg-white hover:bg-neo-yellow transition-colors font-bold cursor-pointer"
                          >
                            {q}
                          </button>
                        ))}
                      </div>

                      {/* Send bar */}
                      <form onSubmit={handleSendJobChatMessage} className="flex gap-2">
                        <input
                          type="text"
                          className="neo-input flex-1 text-xs py-2"
                          placeholder="Ask anything about the scraped content..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          disabled={isChatLoading}
                        />
                        <button
                          type="submit"
                          disabled={isChatLoading || !chatInput.trim()}
                          className="neo-btn neo-btn-primary py-2 px-5 text-xs flex items-center gap-1.5 shrink-0"
                        >
                          <span>QUERY</span> ⚡
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* TAB 4: DOSSIER REPORT */}
                {currentTab === 'report' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center border-b-2 border-primary pb-2 mb-2">
                      <span className="text-xs font-bold uppercase">Executive Dossier File</span>

                      <div className="flex gap-2">
                        <button
                          onClick={handleCopyReport}
                          className="neo-btn-secondary py-1 px-2.5 text-[10px] font-bold"
                        >
                          {copied ? '✓ COPIED' : '📋 COPY DOSSIER'}
                        </button>
                        <button
                          onClick={() => handleDownload('report')}
                          className="neo-btn-accent py-1.5 px-2.5 text-[10px] font-bold"
                        >
                          📥 DOWNLOAD MD
                        </button>
                      </div>
                    </div>

                    <div
                      className="border-4 border-primary p-6 bg-white min-h-[350px] font-sans text-primary break-words leading-relaxed select-text"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(activeJob.report_markdown) }}
                    />
                  </div>
                )}

                {/* TAB 5: LOGS */}
                {currentTab === 'logs' && (
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex justify-between items-center border-b-2 border-primary pb-2 shrink-0">
                      <span className="text-xs font-bold uppercase">Pipeline logs database</span>
                      <span className="text-[10px] bg-primary text-secondary px-2 py-0.5 font-bold">
                        {logs.length} Log Entries
                      </span>
                    </div>

                    <div className="console-log flex-1 overflow-y-auto max-h-[400px]">
                      {logs.map((log, index) => (
                        <div key={index} className="mb-1 text-[11px] font-mono break-all leading-normal whitespace-pre-wrap">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Download Footer bar */}
              <div className="bg-white border-4 border-primary p-4 shadow-[4px_4px_0_0_rgba(26,26,26,1)] flex flex-wrap justify-between items-center gap-3 shrink-0">
                <span className="text-xs font-bold uppercase">Ingestion Export Panel:</span>
                <div className="flex gap-3">
                  <button onClick={() => handleDownload('json')} className="neo-btn-secondary py-1.5 px-4 text-xs font-bold flex items-center gap-1.5">
                    <span>📥</span> JSON FORMAT
                  </button>
                  <button onClick={() => handleDownload('csv')} className="neo-btn-secondary py-1.5 px-4 text-xs font-bold flex items-center gap-1.5">
                    <span>📥</span> CSV SPREADSHEET
                  </button>
                  <button onClick={() => handleDownload('report')} className="neo-btn-accent py-1.5 px-4 text-xs font-bold flex items-center gap-1.5">
                    <span>📥</span> AUDIT REPORT
                  </button>
                </div>
              </div>

            </div>
          )}

        </section>

      </main>

      {/* Page Footer */}
      <footer className="border-t-4 border-primary bg-white py-4 px-6 text-center text-[10px] text-primary/60 font-semibold tracking-wider shrink-0 mt-8">
        DATAPULSE PIPELINE ENGINE // CREATED BY ANTIGRAVITY COGNITIVE ASSISTANT // 2026 ALL RIGHTS CONTROLLED.
      </footer>

    </div>
  );
}

export default App;
