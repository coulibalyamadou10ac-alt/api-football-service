from fastapi import FastAPI
import httpx
import time

app = FastAPI()

# Cache : [données, timestamp]
cache = {"data": None, "timestamp": 0}
CACHE_DURATION = 3600  # 1 heure

API_KEY = "c55fcbcaa34a9f0d9379a2a8272f6354" # Votre clé RapidAPI ici

@app.get("/fixtures")
async def get_fixtures(date: str, timezone: str = "UTC"):
    global cache
    
    # Retourne le cache si valide
    if cache["data"] and (time.time() - cache["timestamp"] < CACHE_DURATION):
        return cache["data"]

    url = f"https://v3.football.api-sports.io/fixtures?date={date}&timezone={timezone}"
    headers = {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io'
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, timeout=20.0)
        data = response.json()
        
        cache["data"] = data
        cache["timestamp"] = time.time()
        return data



