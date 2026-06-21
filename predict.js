const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY, 
  { realtime: { transport: WebSocket } }
);

async function runPrediction() {
  try {
    console.log("Démarrage du scan global des matchs disponibles (Plan Gratuit)...");

    // Appel sans filtre de date sur l'URL pour forcer l'API à donner son flux standard
    const url = 'https://api.football-data.org/v4/matches';
    
    const response = await axios.get(url, {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
    });
    
    const matches = response.data.matches || [];
    console.log(`Nombre total de matchs bruts récupérés : ${matches.length}`);

    if (matches.length === 0) {
      console.log("L'API n'a renvoyé aucun match globalement.");
      return;
    }

    // Récupération des dates de début et de fin de la journée d'aujourd'hui en UTC
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    // Sélection : Matchs prévus aujourd'hui ET qui ne sont pas terminés
    const todayMatches = matches.filter(match => {
      const matchDate = new Date(match.utcDate);
      const isToday = matchDate >= startOfToday && matchDate <= endOfToday;
      const isNotFinished = match.status !== 'FINISHED';
      return isToday && isNotFinished;
    });

    console.log(`Matchs restants à jouer aujourd'hui : ${todayMatches.length}`);

    if (todayMatches.length === 0) {
      console.log("Aucun match à venir trouvé spécifiquement pour aujourd'hui dans ce flux.");
      return;
    }

    // Préparation des lignes pour Supabase
    const predictions = todayMatches.map(match => ({
      match_id: match.id.toString(),
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
      match_date: match.utcDate,
      prediction: "Analyse en attente", 
      created_at: new Date().toISOString()
    }));

    // Insertion dans votre table 'predictions'
    const { error: insertError } = await supabase.from('predictions').insert(predictions);
    if (insertError) throw insertError;

    console.log(`${predictions.length} match(s) du jour enregistré(s) avec succès !`);

  } catch (error) {
    console.error("Erreur lors de l'exécution :");
    if (error.response) {
      console.error("Détails API :", JSON.stringify(error.response.data));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

runPrediction();

