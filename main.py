from fastapi import FastAPI
import httpx
import os

app = FastAPI()
API_KEY = "94d2f6a0743159e79b0c2e587b720748" 

@app.get("/fixtures")
async def get_fixtures(date: str, timezone: str):
    url = f"https://v3.football.api-sports.io/fixtures?date={date}&timezone={timezone}"
    headers = {'x-rapidapi-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io'}
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        return response.json()

@app.get("/predictions")
async def get_predictions(fixture: int):
    url = f"https://v3.football.api-sports.io/predictions?fixture={fixture}"
    headers = {'x-rapidapi-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io'}
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        return response.json()

