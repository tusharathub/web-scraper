from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
from bs4 import BeautifulSoup
import traceback
import os
import time
from groq import Groq
from dotenv import load_dotenv

# Import pipeline core modules
from pipeline import (
    PipelineConfig, 
    PipelineManager, 
    JobDetails,
    JobMetadata
)

load_dotenv()

app = FastAPI(title="Web Scraper API")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScrapeRequest(BaseModel):
    url: str
    selector: Optional[str] = None

class ScrapeResponse(BaseModel):
    url: str
    title: Optional[str]
    elements: list[str]
    error: Optional[str] = None

class AiChatRequest(BaseModel):
    data: list[str]
    prompt: str

class AiChatResponse(BaseModel):
    response: str
    error: Optional[str] = None

@app.post("/api/scrape", response_model=ScrapeResponse)
async def scrape_url(req: ScrapeRequest):
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
            }
            response = await client.get(req.url, headers=headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            title = soup.title.string if soup.title else None
            
            extracted_elements = []
            if req.selector:
                elements = soup.select(req.selector)
                extracted_elements = [str(el) for el in elements]
            else:
                # If no selector is provided, just extract some basic textual context or meta tags
                # For this demo, let's just return all paragraphs and headers as strings
                # Or just basic text snippets
                texts = [p.get_text(strip=True) for p in soup.find_all(['h1', 'h2', 'h3', 'p']) if p.get_text(strip=True)]
                extracted_elements = texts
                
            return ScrapeResponse(url=req.url, title=title, elements=extracted_elements)

    except Exception as e:
        traceback.print_exc()
        return ScrapeResponse(url=req.url, title=None, elements=[], error=str(e))


@app.post("/api/chat", response_model=AiChatResponse)
async def chat_with_data(req: AiChatRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_ai_rate_limit(client_ip, limit=AI_LIMIT_CHAT, window=AI_LIMIT_WINDOW)

    try:
        if not os.getenv("GROQ_API_KEY"):
            raise HTTPException(status_code=500, detail="Groq API Key is missing.")

        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        
        # Combine scraped data to provide as context
        context_data = "\n".join(req.data[:100]) # Limit to first 100 elements to avoid context window issues
        system_instruction = f"You are an AI assistant helping the user analyze some scraped web data. Here is the data they scraped:\n\n{context_data}\n\nAnswer their questions based on this data."
        
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": req.prompt}
            ],
            model="llama-3.1-8b-instant",
        )
        
        return AiChatResponse(response=response.choices[0].message.content)

    except Exception as e:
        traceback.print_exc()
        return AiChatResponse(response="", error=str(e))


# ==========================================
# RATE LIMITER LOGIC
# ==========================================

# In-memory record tracking client IP -> list of AI request timestamps
ai_rate_limits = {}

# Configurable limits from environment variables with sensible defaults
AI_LIMIT_RUNS = int(os.getenv("AI_LIMIT_RUNS", "5"))         # max AI ingestions per window
AI_LIMIT_CHAT = int(os.getenv("AI_LIMIT_CHAT", "10"))        # max AI queries per window
AI_LIMIT_WINDOW = int(os.getenv("AI_LIMIT_WINDOW", "60"))    # time window in seconds

def check_ai_rate_limit(client_ip: str, limit: int, window: int):
    """Checks and updates client request rate records. Raises 429 if limit exceeded."""
    now = time.time()
    
    if client_ip not in ai_rate_limits:
        ai_rate_limits[client_ip] = []
        
    # Filter out timestamps older than the time window
    timestamps = [t for t in ai_rate_limits[client_ip] if now - t < window]
    ai_rate_limits[client_ip] = timestamps
    
    if len(timestamps) >= limit:
        # Calculate approximate time to wait until next token is available
        wait_time = int(window - (now - timestamps[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for AI features. Please retry in {wait_time} seconds."
        )
        
    ai_rate_limits[client_ip].append(now)


# ==========================================
# PIPELINE ENDPOINTS
# ==========================================

@app.post("/api/pipeline/run", response_model=JobDetails)
async def run_pipeline(config: PipelineConfig, request: Request):
    if config.analysis.run_ai:
        client_ip = request.client.host if request.client else "127.0.0.1"
        check_ai_rate_limit(client_ip, limit=AI_LIMIT_RUNS, window=AI_LIMIT_WINDOW)

    try:
        details = await PipelineManager.run(config)
        return details
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Pipeline execution error: {str(e)}")


class JobChatRequest(BaseModel):
    data: List[str]
    prompt: str
    model: Optional[str] = "llama-3.1-8b-instant"


@app.post("/api/pipeline/chat")
async def chat_stateless(req: JobChatRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_ai_rate_limit(client_ip, limit=AI_LIMIT_CHAT, window=AI_LIMIT_WINDOW)

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Groq API Key is not set in backend environment.")
        
    try:
        client = Groq(api_key=api_key)
        
        # Combine elements as context
        context_data = "\n".join(req.data[:100])
        system_instruction = (
            "You are an AI assistant helping the user analyze some scraped web data.\n"
            f"Here is the cleaned data that they extracted:\n\n{context_data}\n\n"
            "Answer the user's questions based on this data. Be concise, direct and helpful."
        )
        
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": req.prompt}
            ],
            model=req.model or "llama-3.1-8b-instant",
            temperature=0.3
        )
        
        return {"response": response.choices[0].message.content}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Groq Chat API call failed: {str(e)}")

# run command -> python -m uvicorn main:app --reload --port 8000