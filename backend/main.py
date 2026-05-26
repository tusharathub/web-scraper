from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import httpx
from bs4 import BeautifulSoup
import traceback


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


# run command -> python -m uvicorn main:app --reload --port 8000