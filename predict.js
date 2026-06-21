const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY, 
  { realtime: { transport: WebSocket } }
);

// Les 3 ligues majeures les plus actives et accessibles gratuitement
const LEAGUES = ['PL', 'PD', 'FL1', 'BL1', 'SA', 'CL'];

async function runPrediction() {
  try {
    console.log("Extraction forcée des matchs du jour (Plan Gratuit)...");
    let allMatches = [];

    // On parcourt les ligues une par une pour récupérer TOUS leurs matchs planifiés
    for (const league of LEAGUES) {
      try {
        const url = `https://api.football-data.org/v4/competitions/${league}/matches?status=SCHEDULED`;
        const response = await axios.get(url, {
          headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
        });
        
        if (response.data.matches) {
          allMatches = allMatches.concat(response.data.matches);
        }
        // Pause pour respecter le quota de la clé gratuite
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (err) {
        console.log(`Ligue ${league} indisponible ou fin de saison.`);
      }
    }

    console.log(`Nombre total de matchs futurs récupérés : ${allMatches.length}`);

    // Filtre : On isole uniquement les matchs qui se jouent AUJOURD'HUI
    const todayStr = new Date().toISOString().split('T')[0];
    const todayMatches = allMatches.filter(match => match.utcDate.startsWith(todayStr));

    console.log(`Matchs identifiés pour aujourd'hui (${todayStr}) : ${todayMatches.length}`);

    if (todayMatches.length === 0) {
      console.log("Aucun match de prévu aujourd'hui dans les ligues gratuites.");
      return;
    }

    // Préparation pour Supabase
    const predictions = todayMatches.map(match => ({
      match_id: match.id.toString(),
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
      match_date: match.utcDate,
      prediction: "Analyse IA en attente", 
      created_at: new Date().toISOString()
    }));

    // Insertion
    const { error: insertError } = await supabase.from('predictions').insert(predictions);
    if (insertError) throw insertError;

    console.log(`${predictions.length} match(s) enregistré(s) avec succès !`);

  } catch (error) {
    console.error("Erreur générale :", error.message);
    process.exit(1);
  }
}

runPrediction();

