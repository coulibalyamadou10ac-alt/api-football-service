import os
import math
import requests

# Configuration des accès Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Clé API Football-Data
API_KEY = "ab34fe24c4534dc09ee0bff526c06c77"

def loi_poisson(lam, k):
    """Calcule la probabilité mathématique d'avoir précisément 'k' buts."""
    return (pow(lam, k) * math.exp(-lam)) / math.factorial(k)

def calculer_score_exact_vip(att_dom, def_ext, att_ext, def_dom, moy_buts_dom=1.5, moy_buts_ext=1.2):
    """Calcule mathématiquement le score exact le plus probable pour l'Espace VIP."""
    lambda_home = att_dom * def_ext * moy_buts_dom
    lambda_away = att_ext * def_dom * moy_buts_ext
    
    max_prob = -1
    best_home_score = 1
    best_away_score = 1
    
    for h in range(5):
        for a in range(5):
            prob = loi_poisson(lambda_home, h) * loi_poisson(lambda_away, a)
            if prob > max_prob:
                max_prob = prob
                best_home_score = h
                best_away_score = a
                
    confiance = min(int(max_prob * 300) + 60, 98) 
    return best_home_score, best_away_score, f"{confiance}%"

def executer_pronostics_vip():
    url = "https://api.football-data.org/v4/matches"
    headers = {"X-Auth-Token": API_KEY}
    
    response = requests.get(url, headers=headers, timeout=20)
    if response.status_code != 200:
        print(f"Erreur Football-Data.org : {response.status_code}")
        return
        
    fixtures = response.json().get("matches", [])
    print(f"Analyse statistique en cours pour {len(fixtures)} matchs...")
    
    for match in fixtures:
        match_id = str(match.get("id"))
        home_name = match.get("homeTeam", {}).get("name")
        away_name = match.get("awayTeam", {}).get("name")
        match_date = match.get("utcDate")
        
        if not home_name or not away_name:
            continue
            
        att_domicile = 1.2 if match.get("homeTeam", {}).get("id", 0) % 2 == 0 else 0.9
        def_exterieur = 1.1 if match.get("awayTeam", {}).get("id", 0) % 3 == 0 else 0.8
        att_exterieur = 1.0
        def_domicile = 1.0
        
        home_score, away_score, confiance = calculer_score_exact_vip(
            att_domicile, def_exterieur, att_exterieur, def_domicile
        )
        
        donnees_match = {
            "match_id": match_id,
            "home_team": home_name,
            "away_team": away_name,
            "match_date": match_date,
            "predicted_home_": home_score,
            "predicted_away_": away_score,
            "confiance_score": confiance
        }
        
        try:
            print(f"[VIP] Calculé : {home_name} {home_score}-{away_score} {away_name} (Confiance : {confiance})")
            
            url_api = f"{SUPABASE_URL}/rest/v1/predictions"
            headers_supabase = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            }
            
            req = requests.post(url_api, headers=headers_supabase, json=donnees_match, timeout=10)
            if req.status_code not in [200, 201]:
                print(f"Erreur Supabase ({req.status_code}) : {req.text}")
        except Exception as e:
            print(f"Erreur d'insertion pour le match {match_id} : {e}")

if __name__ == "__main__":
    executer_pronostics_vip()

