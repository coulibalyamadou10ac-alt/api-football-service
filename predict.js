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
    console.log("Extraction ciblée sur la Coupe du Monde (WC)...");

    // On demande tous les matchs de la Coupe du Monde à l'API
    const url = 'https://api.football-data.org/v4/competitions/WC/matches';
    const response = await axios.get(url, {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
    });
    
    const matches = response.data.matches || [];
    console.log(`Nombre total de matchs de Coupe du Monde trouvés : ${matches.length}`);

    // Filtre : On isole uniquement les matchs qui se jouent AUJOURD'HUI
    const todayStr = new Date().toISOString().split('T')[0];
    const todayMatches = matches.filter(match => {
      const matchDateStr = match.utcDate.split('T')[0];
      const isToday = matchDateStr === todayStr;
      const isNotFinished = match.status !== 'FINISHED';
      return isToday && isNotFinished;
    });

    console.log(`Matchs de Coupe du Monde restants pour aujourd'hui (${todayStr}) : ${todayMatches.length}`);

    if (todayMatches.length === 0) {
      console.log("Aucun match de Coupe du Monde prévu ou restant à jouer aujourd'hui.");
      return;
    }

    // Préparation pour Supabase
    const predictions = todayMatches.map(match => ({
      match_id: match.id.toString(),
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
      match_date: match.utcDate,
      prediction: "Analyse en attente", 
      created_at: new Date().toISOString()
    }));

    // Insertion dans Supabase
    const { error: insertError } = await supabase.from('predictions').insert(predictions);
    if (insertError) throw insertError;

    console.log(`${predictions.length} match(s) enregistré(s) avec succès !`);

  } catch (error) {
    console.error("Erreur générale :", error.message);
    process.exit(1);
  }
}

runPrediction();

