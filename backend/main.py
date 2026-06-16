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
)


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