import os
import math
import requests
from datetime import datetime, timedelta

# 1. Configuration Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not SUPABASE_KEY:
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
SUPABASE_KEY = SUPABASE_KEY.strip()

# 2. Clé API Football-Data.org
API_KEY = "ab34fe24c4534dc09ee0bff526c06c77"
HEADERS_FOOTBALL = {"X-Auth-Token": API_KEY}

# Cache pour éviter de surcharger l'API en téléchargeant le même classement plusieurs fois
CACHE_CLASSEMENTS = {}

def loi_poisson(lam, k):
    """Calcule la probabilité mathématique d'avoir précisément 'k' buts."""
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return (pow(lam, k) * math.exp(-lam)) / math.factorial(k)

def recuperer_stats_equipes(competition_code):
    """Récupère les vraies statistiques d'attaque et de défense de la ligue depuis l'API."""
    if competition_code in CACHE_CLASSEMENTS:
        return CACHE_CLASSEMENTS[competition_code]
        
    url = f"https://api.football-data.org/v4/competitions/{competition_code}/standings"
    try:
        res = requests.get(url, headers=HEADERS_FOOTBALL, timeout=15)
        if res.status_code != 200:
            return None
            
        data = res.json()
        standings = data.get("standings", [])
        if not standings:
            return None
            
        stats_equipes = {}
        total_buts = 0
        total_matchs = 0
        
        # On parcourt le classement général (table)
        for table in standings[0].get("table", []):
            team_id = table.get("team", {}).get("id")
            played = table.get("playedGames", 0)
            goals_for = table.get("goalsFor", 0)
            goals_against = table.get("goalsAgainst", 0)
            
            if played > 0:
                stats_equipes[team_id] = {
                    "buts_marques_moyen": goals_for / played,
                    "buts_encaisses_moyen": goals_against / played
                }
                total_buts += goals_for
                total_matchs += played
                
        # Moyenne générale de buts marqués par une équipe dans cette ligue
        moyenne_ligue = (total_buts / total_matchs) if total_matchs > 0 else 1.3
        
        resultat = {"equipes": stats_equipes, "moyenne_ligue": moyenne_ligue}
        CACHE_CLASSEMENTS[competition_code] = resultat
        return resultat
    except Exception:
        return None

def calculer_score_exact_vip(home_id, away_id, stats_ligue):
    """Calcule le score le plus probable basé sur les vraies performances de la saison."""
    if not stats_ligue or home_id not in stats_ligue["equipes"] or away_id not in stats_ligue["equipes"]:
        # Valeurs par défaut si l'équipe est nouvelle ou stats manquantes
        lambda_home = 1.3
        lambda_away = 1.1
    else:
        equipe_dom = stats_ligue["equipes"][home_id]
        equipe_ext = stats_ligue["equipes"][away_id]
        moy_ligue = stats_ligue["moyenne_ligue"]
        
        # Force d'attaque Dom = Buts marqués Dom / Moyenne Ligue
        force_att_dom = equipe_dom["buts_marques_moyen"] / moy_ligue if moy_ligue > 0 else 1
        # Force de défense Ext = Buts encaissés Ext / Moyenne Ligue
        force_def_ext = equipe_ext["buts_encaisses_moyen"] / moy_ligue if moy_ligue > 0 else 1
        
        # Force d'attaque Ext = Buts marqués Ext / Moyenne Ligue
        force_att_ext = equipe_ext["buts_marques_moyen"] / moy_ligue if moy_ligue > 0 else 1
        # Force de défense Dom = Buts encaissés Dom / Moyenne Ligue
        force_def_dom = equipe_dom["buts_encaisses_moyen"] / moy_ligue if moy_ligue > 0 else 1
        
        # Calcul des espérances de buts réelles
        lambda_home = force_att_dom * force_def_ext * moy_ligue
        lambda_away = force_att_ext * force_def_dom * moy_ligue

    max_prob = -1
    best_home_score = 1
    best_away_score = 1
    
    # Recherche du score exact optimal (0 à 4 buts)
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
    date_debut = datetime.utcnow().strftime("%Y-%m-%d")
    date_fin = (datetime.utcnow() + timedelta(days=3)).strftime("%Y-%m-%d")
    
    url = f"https://api.football-data.org/v4/matches?dateFrom={date_debut}&dateTo={date_fin}"
    print(f"Extraction des matchs réels : {url}")
    response = requests.get(url, headers=HEADERS_FOOTBALL, timeout=20)
    
    if response.status_code != 200:
        print(f"Erreur API Football : {response.status_code}")
        return
        
    fixtures = response.json().get("matches", [])
    if not fixtures:
        print("Aucun match prévu ces 3 prochains jours.")
        return
        
    print(f"Analyse statistique réelle démarrée pour {len(fixtures)} matchs...")
    
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
        competition_code = match.get("competition", {}).get("code")
        
        home_team = match.get("homeTeam", {})
        away_team = match.get("awayTeam", {})
        
        home_id = home_team.get("id")
        away_id = away_team.get("id")
        home_name = home_team.get("name")
        away_name = away_team.get("name")
        match_date = match.get("utcDate")
        
        if not home_name or not away_name or not competition_code:
            continue
            
        # Récupération des vraies forces du championnat actuel
        stats_ligue = recuperer_stats_equipes(competition_code)
        
        # Calcul du vrai score exact
        home_score, away_score, confiance = calculer_score_exact_vip(home_id, away_id, stats_ligue)
        
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
            print(f"[VIP RÉEL] {home_name} {home_score}-{away_score} {away_name} ({confiance})")
            res = requests.post(url_api, headers=headers_supabase, json=donnees_match, timeout=15)
            if res.status_code not in [200, 201]:
                print(f"Erreur d'insertion Supabase : {res.text}")
        except Exception as e:
            print(f"Erreur de connexion Supabase : {e}")

if __name__ == "__main__":
    executer_pronostics_vip()

