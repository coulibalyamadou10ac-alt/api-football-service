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
    console.log("Démarrage du scan des matchs du jour...");

    // On récupère la date du jour au format YYYY-MM-DD exigé par l'API
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Une seule requête sur l'URL générale avec le filtre de date du jour
    const url = `https://api.football-data.org/v4/matches?dateFrom=${todayStr}&dateTo=${todayStr}`;
    
    const response = await axios.get(url, {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
    });
    
    const matches = response.data.matches || [];
    console.log(`Nombre total de matchs reçus de l'API pour aujourd'hui : ${matches.length}`);

    // On filtre uniquement pour exclure les matchs déjà terminés (FINISHED)
    const upcomingMatches = matches.filter(match => match.status !== 'FINISHED');
    console.log(`Matchs restants à jouer ou en cours : ${upcomingMatches.length}`);

    if (upcomingMatches.length === 0) {
      console.log("Aucun match à venir pour le reste de la journée.");
      return;
    }

    // Préparation des données pour Supabase
    const predictions = upcomingMatches.map(match => ({
      match_id: match.id.toString(),
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
      match_date: match.utcDate,
      prediction: "Analyse en attente", 
      created_at: new Date().toISOString()
    }));

    // Insertion directe dans votre table 'predictions'
    const { error: insertError } = await supabase.from('predictions').insert(predictions);
    if (insertError) throw insertError;

    console.log(`${predictions.length} match(s) enregistré(s) avec succès dans Supabase !`);

  } catch (error) {
    console.error("Erreur critique lors de la récupération :");
    if (error.response) {
      console.error("Détails API :", JSON.stringify(error.response.data));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

runPrediction();

