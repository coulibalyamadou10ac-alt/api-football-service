import os
import httpx
from fastapi import FastAPI

app = FastAPI()
# C'est ici que le code "lit" la clé que vous avez mise sur Render
API_KEY = os.getenv("API_KEY") 

@app.get("/fixtures")
async def get_fixtures(date: str, timezone: str):
    url = f"https://v3.football.api-sports.io/fixtures?date={date}&timezone={timezone}"
    # Vérifiez que ces noms de headers sont EXACTS
    headers = {
        'x-rapidapi-key': str(API_KEY), 
        'x-rapidapi-host': 'v3.football.api-sports.io'
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

