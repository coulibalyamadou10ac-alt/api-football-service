import os
import math
import requests
from datetime import datetime, timedelta

# 1. Configuration et nettoyage automatique des variables Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not SUPABASE_KEY:
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
SUPABASE_KEY = SUPABASE_KEY.strip()

# 2. Clé API Football-Data.org
API_KEY = "ab34fe24c4534dc09ee0bff526c0c77"

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
    # Définition d'une plage de date (Aujourd'hui à J+3) pour éviter l'erreur 400 sur la requête globale
    date_debut = datetime.utcnow().strftime("%Y-%m-%d")
    date_fin = (datetime.utcnow() + timedelta(days=3)).strftime("%Y-%m-%d")
    
    # URL avec filtres temporels acceptés par l'API Football-Data
    url = f"https://api.football-data.org/v4/matches?dateFrom={date_debut}&dateTo={date_fin}"
    headers = {"X-Auth-Token": API_KEY}
    
    print(f"Requête Football-Data : {url}")
    response = requests.get(url, headers=headers, timeout=20)
    
    # Si la requête globale échoue encore, on tente un repli sur la liste générale des matchs
    if response.status_code == 400:
        print("Ajustement de la requête suite à l'erreur 400 (Tentative sans filtres)...")
        url_fallback = "https://api.football-data.org/v4/matches"
        response = requests.get(url_fallback, headers=headers, timeout=20)

    if response.status_code != 200:
        print(f"Erreur Football-Data.org : {response.status_code}")
        print(f"Détails de l'erreur : {response.text}")
        return
        
    fixtures = response.json().get("matches", [])
    if not fixtures:
        print("Aucun match trouvé pour la période sélectionnée.")
        return
        
    print(f"Analyse statistique en cours pour {len(fixtures)} matchs...")
    
    # Construction propre et robuste de l'URL pour l'API REST de Supabase
    url_base = SUPABASE_URL if SUPABASE_URL.endswith("/") else f"{SUPABASE_URL}/"
    url_api = f"{url_base}rest/v1/predictions"
    
    headers_supabase = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    
    for match in fixtures:
        match_id = str(match.get("id"))
        home_name = match.get("homeTeam", {}).get("name")
        away_name = match.get("awayTeam", {}).get("name")
        match_date = match.get("utcDate")
        
        if not home_name or not away_name:
            continue
            
        # Simulation basique des coefficients d'attaque/défense basée sur les IDs
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
            "predicted_home_score": home_score,
            "predicted_away_score": away_score,
            "confiance_score": confiance
        }
        
        try:
            print(f"[VIP] Calculé : {home_name} {home_score}-{away_score} {away_name} (Confiance : {confiance})")
            res = requests.post(url_api, headers=headers_supabase, json=donnees_match, timeout=15)
            if res.status_code not in [200, 201]:
                print(f"Erreur Supabase ({res.status_code}) : {res.text}")
        except Exception as e:
            print(f"Erreur d'insertion pour le match {match_id} : {e}")

if __name__ == "__main__":
    executer_pronostics_vip()
