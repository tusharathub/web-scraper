import os
import re
import json
import string
import time
from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
import httpx
from bs4 import BeautifulSoup
from groq import Groq

# A standard set of English stopwords to clean text
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could",
    "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for",
    "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's",
    "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm",
    "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't",
    "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't",
    "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
    "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too",
    "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't",
    "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's",
    "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself",
    "yourselves"
}

class CleaningConfig(BaseModel):
    lowercase: bool = False
    remove_punctuation: bool = False
    normalize_whitespace: bool = True
    remove_stopwords: bool = False
    min_line_length: int = 0
    deduplicate: bool = True

class AnalysisConfig(BaseModel):
    run_ai: bool = True
    model: str = "llama-3.1-8b-instant"

class PipelineConfig(BaseModel):
    url: str
    selectors: Optional[List[str]] = None
    cleaning: CleaningConfig = CleaningConfig()
    analysis: AnalysisConfig = AnalysisConfig()

class JobMetadata(BaseModel):
    job_id: str
    url: str
    selectors: List[str]
    timestamp: str
    duration_ms: float
    raw_size_bytes: int
    clean_size_bytes: int
    items_scraped: int
    items_cleaned: int
    status: str
    error: Optional[str] = None
    
    # Analysis outputs
    word_count: int = 0
    sentence_count: int = 0
    estimated_read_time_sec: int = 0
    has_ai_analysis: bool = False
    ai_summary: Optional[str] = None
    ai_sentiment: Optional[str] = None
    ai_sentiment_score: Optional[float] = None
    ai_entities: List[str] = []
    ai_topics: List[str] = []

class JobDetails(BaseModel):
    meta: JobMetadata
    raw_elements: List[str]
    cleaned_elements: List[str]
    report_markdown: str
    logs: List[str]

class PipelineCleaner:
    @staticmethod
    def clean_item(text: str, config: CleaningConfig) -> str:
        if not text:
            return ""
        
        # Strip HTML tags if present (as a fallback)
        text = re.sub(r'<[^>]+>', '', text)
        
        if config.lowercase:
            text = text.lower()
            
        if config.remove_punctuation:
            text = text.translate(str.maketrans("", "", string.punctuation))
            
        if config.remove_stopwords:
            words = text.split()
            words = [w for w in words if w.lower() not in STOPWORDS]
            text = " ".join(words)
            
        if config.normalize_whitespace:
            text = re.sub(r'\s+', ' ', text).strip()
            
        return text

    @classmethod
    def clean_elements(cls, raw: List[str], config: CleaningConfig) -> List[str]:
        cleaned = []
        seen = set()
        
        for item in raw:
            c_item = cls.clean_item(item, config)
            if not c_item:
                continue
            
            # Check length filter
            if len(c_item) < config.min_line_length:
                continue
                
            # Check deduplication
            if config.deduplicate:
                if c_item in seen:
                    continue
                seen.add(c_item)
                
            cleaned.append(c_item)
            
        return cleaned

class PipelineAnalyzer:
    @staticmethod
    def calculate_basic_metrics(elements: List[str]) -> Dict[str, int]:
        text_blob = " ".join(elements)
        word_count = len(text_blob.split())
        
        # Simple sentence count regex
        sentences = re.split(r'[.!?]+', text_blob)
        sentences = [s for s in sentences if s.strip()]
        sentence_count = max(1, len(sentences)) if text_blob.strip() else 0
        
        # Standard average reading speed is ~200 words per minute (~3.3 words per second)
        estimated_read_time_sec = int(word_count / 3.3)
        
        return {
            "word_count": word_count,
            "sentence_count": sentence_count,
            "estimated_read_time_sec": estimated_read_time_sec
        }

    @staticmethod
    def run_ai_insights(elements: List[str], config: AnalysisConfig) -> Dict[str, Any]:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return {
                "has_ai": False,
                "error": "Groq API Key is not set in backend environment."
            }
            
        try:
            client = Groq(api_key=api_key)
            
            # Combine the first few cleaned elements as context
            context_data = "\n".join(elements[:80]) # Limit to avoid context limit
            if not context_data.strip():
                return {"has_ai": False, "error": "No cleaned text data available for AI analysis."}
                
            system_instruction = (
                "You are an expert data analysis engine. Analyze the following scraped and cleaned text content. "
                "You MUST return a JSON response containing these exact fields:\n"
                "{\n"
                "  \"summary\": \"A concise 2-3 sentence summary of the main topic/context\",\n"
                "  \"sentiment\": \"Positive, Negative, or Neutral\",\n"
                "  \"sentiment_score\": A float value between -1.0 (strongly negative) and 1.0 (strongly positive),\n"
                "  \"entities\": [\"List of key people, organizations, locations, or products found in the text (max 6)\"],\n"
                "  \"topics\": [\"List of main keywords or categorizing themes (max 5)\"]\n"
                "}\n"
                "Respond ONLY with the raw JSON object. Do not include markdown code block characters (like ```json)."
            )
            
            response = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": f"Text Content to analyze:\n\n{context_data}"}
                ],
                model=config.model,
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            
            res_content = response.choices[0].message.content.strip()
            parsed = json.loads(res_content)
            
            return {
                "has_ai": True,
                "ai_summary": parsed.get("summary"),
                "ai_sentiment": parsed.get("sentiment"),
                "ai_sentiment_score": parsed.get("sentiment_score"),
                "ai_entities": parsed.get("entities", []),
                "ai_topics": parsed.get("topics", [])
            }
            
        except Exception as e:
            return {
                "has_ai": False,
                "error": f"Groq API call failed: {str(e)}"
            }

class PipelineReporter:
    @staticmethod
    def generate_markdown(meta: JobMetadata, cleaned_elements: List[str]) -> str:
        date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        md = []
        md.append(f"# DATA PROCESSING REPORT")
        md.append(f"**Generated**: {date_str}  ")
        md.append(f"**Job ID**: `{meta.job_id}`  ")
        md.append(f"**Target URL**: [{meta.url}]({meta.url})  ")
        
        md.append("\n## 1. Pipeline Metrics")
        md.append("| Metric | Value |")
        md.append("|---|---|")
        md.append(f"| Status | **{meta.status.upper()}** |")
        md.append(f"| Scraped Elements | {meta.items_scraped} |")
        md.append(f"| Cleaned Elements | {meta.items_cleaned} |")
        reduction = 0
        if meta.raw_size_bytes > 0:
            reduction = int((1 - (meta.clean_size_bytes / meta.raw_size_bytes)) * 100)
        md.append(f"| File Size Reduction | {reduction}% ({meta.raw_size_bytes} B ➔ {meta.clean_size_bytes} B) |")
        md.append(f"| Total Words | {meta.word_count} |")
        md.append(f"| Total Sentences | {meta.sentence_count} |")
        md.append(f"| Est. Reading Time | {meta.estimated_read_time_sec} seconds |")
        md.append(f"| Processing Duration | {meta.duration_ms:.2f} ms |")
        
        if meta.has_ai_analysis:
            md.append("\n## 2. AI Data Insights")
            md.append(f"### Summary\n{meta.ai_summary}\n")
            
            sentiment_color = "Neutral ⚪"
            if meta.ai_sentiment_score is not None:
                if meta.ai_sentiment_score > 0.1:
                    sentiment_color = f"Positive 🟢 (Score: {meta.ai_sentiment_score})"
                elif meta.ai_sentiment_score < -0.1:
                    sentiment_color = f"Negative 🔴 (Score: {meta.ai_sentiment_score})"
                else:
                    sentiment_color = f"Neutral 🟡 (Score: {meta.ai_sentiment_score})"
                    
            md.append(f"### Sentiment Analysis\n- **Overall Tone**: {meta.ai_sentiment} ({sentiment_color})\n")
            
            if meta.ai_topics:
                md.append("### Key Topics")
                for topic in meta.ai_topics:
                    md.append(f"- `{topic}`")
                md.append("")
                
            if meta.ai_entities:
                md.append("### Identified Entities")
                for entity in meta.ai_entities:
                    md.append(f"- **{entity}**")
                md.append("")
        else:
            md.append("\n## 2. AI Data Insights")
            md.append("*AI insights were not executed or encountered an error.*")
            if meta.error:
                md.append(f"\n**Error Message**: `{meta.error}`")
                
        md.append("\n## 3. Data Sample (First 10 Items)")
        if cleaned_elements:
            for i, el in enumerate(cleaned_elements[:10]):
                md.append(f"{i+1}. {el}")
        else:
            md.append("*No elements extracted after cleaning.*")
            
        md.append("\n---\n*Report generated automatically by Antigravity Pipeline Engine.*")
        return "\n".join(md)

class PipelineManager:
    @staticmethod
    async def run(config: PipelineConfig) -> JobDetails:
        start_time = time.time()
        job_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        raw_elements = []
        cleaned_elements = []
        logs = []
        status = "pending"
        error_msg = None
        
        try:
            # 1. Scrape
            logs.append(f"[{datetime.now().isoformat()}] Starting scraping URL: {config.url}")
            async with httpx.AsyncClient(follow_redirects=True, timeout=12.0) as client:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
                }
                response = await client.get(config.url, headers=headers)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                if config.selectors and len(config.selectors) > 0:
                    combined_selector = ", ".join(config.selectors)
                    logs.append(f"[{datetime.now().isoformat()}] Parsing elements matching selector: {combined_selector}")
                    elements = soup.select(combined_selector)
                    raw_elements = [el.get_text(strip=True) for el in elements if el.get_text(strip=True)]
                else:
                    logs.append(f"[{datetime.now().isoformat()}] No selectors provided. Extracting headings and paragraphs.")
                    tags = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'p'])
                    raw_elements = [t.get_text(strip=True) for t in tags if t.get_text(strip=True)]
            
            logs.append(f"[{datetime.now().isoformat()}] Scraped {len(raw_elements)} raw text elements.")
            
            # 2. Clean
            logs.append(f"[{datetime.now().isoformat()}] Starting data cleaning phase...")
            cleaned_elements = PipelineCleaner.clean_elements(raw_elements, config.cleaning)
            logs.append(f"[{datetime.now().isoformat()}] Cleaned down to {len(cleaned_elements)} elements.")
            
            # Calculate raw and clean size
            raw_size = sum(len(el.encode('utf-8')) for el in raw_elements)
            clean_size = sum(len(el.encode('utf-8')) for el in cleaned_elements)
            
            # 3. Analyze Basic
            logs.append(f"[{datetime.now().isoformat()}] Computing text analytics...")
            basic_metrics = PipelineAnalyzer.calculate_basic_metrics(cleaned_elements)
            
            # 4. Analyze AI
            ai_data = {}
            if config.analysis.run_ai and len(cleaned_elements) > 0:
                logs.append(f"[{datetime.now().isoformat()}] Querying Groq ({config.analysis.model}) for AI insights...")
                ai_data = PipelineAnalyzer.run_ai_insights(cleaned_elements, config.analysis)
                if not ai_data.get("has_ai"):
                    error_msg = ai_data.get("error")
                    logs.append(f"[{datetime.now().isoformat()}] AI Insights Warning: {error_msg}")
                else:
                    logs.append(f"[{datetime.now().isoformat()}] Successfully completed AI analytics.")
            else:
                logs.append(f"[{datetime.now().isoformat()}] Skipping AI analytics.")
                
            status = "completed"
            duration_ms = (time.time() - start_time) * 1000
            
            meta = JobMetadata(
                job_id=job_id,
                url=config.url,
                selectors=config.selectors or [],
                timestamp=datetime.now().isoformat(),
                duration_ms=duration_ms,
                raw_size_bytes=raw_size,
                clean_size_bytes=clean_size,
                items_scraped=len(raw_elements),
                items_cleaned=len(cleaned_elements),
                status=status,
                error=error_msg,
                word_count=basic_metrics.get("word_count", 0),
                sentence_count=basic_metrics.get("sentence_count", 0),
                estimated_read_time_sec=basic_metrics.get("estimated_read_time_sec", 0),
                has_ai_analysis=ai_data.get("has_ai", False),
                ai_summary=ai_data.get("ai_summary"),
                ai_sentiment=ai_data.get("ai_sentiment"),
                ai_sentiment_score=ai_data.get("ai_sentiment_score"),
                ai_entities=ai_data.get("ai_entities", []),
                ai_topics=ai_data.get("ai_topics", [])
            )
            
            logs.append(f"[{datetime.now().isoformat()}] Generating pipeline Markdown report...")
            report_md = PipelineReporter.generate_markdown(meta, cleaned_elements)
            
            return JobDetails(
                meta=meta,
                raw_elements=raw_elements,
                cleaned_elements=cleaned_elements,
                report_markdown=report_md,
                logs=logs
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            status = "failed"
            error_str = str(e)
            logs.append(f"[{datetime.now().isoformat()}] Pipeline execution failed: {error_str}")
            
            meta = JobMetadata(
                job_id=job_id,
                url=config.url,
                selectors=config.selectors or [],
                timestamp=datetime.now().isoformat(),
                duration_ms=duration_ms,
                raw_size_bytes=0,
                clean_size_bytes=0,
                items_scraped=0,
                items_cleaned=0,
                status=status,
                error=error_str
            )
            
            return JobDetails(
                meta=meta,
                raw_elements=[],
                cleaned_elements=[],
                report_markdown=f"# Pipeline Run Failed\n\nError: {error_str}",
                logs=logs
            )
