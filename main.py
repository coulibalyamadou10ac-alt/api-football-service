from fastapi import FastAPI
import httpx

app = FastAPI()

@app.get("/fixtures")
async def get_fixtures(date: str, timezone: str):
    # La clé est écrite directement ici, sans passer par os.getenv
    url = f"https://v3.football.api-sports.io/fixtures?date={date}&timezone={timezone}"
    headers = {
        'x-rapidapi-key': '94d2f6a0743159e79b0c2e587b720748',
        'x-rapidapi-host': 'v3.football.api-sports.io'
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        return response.json()


