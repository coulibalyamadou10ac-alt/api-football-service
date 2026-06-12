from fastapi import FastAPI
import httpx
import os

app = FastAPI()

@app.get("/api/matchs")
async def get_matchs():
    async with httpx.AsyncClient() as client:
        # Remplacez VOTRE_CLE_API par votre clé réelle
        headers = {'x-rapidapi-key': 'VOTRE_CLE_API'}
        resp = await client.get("https://v3.football.api-sports.io/fixtures?date=2026-06-12&timezone=UTC", headers=headers)
        return resp.json()

