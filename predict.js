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
    console.log("Démarrage de l'algorithme intelligent AFRISTATS...");

    const response = await axios.get('https://api.football-data.org/v4/matches', {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
    });
    
    const matches = response.data.matches;
    const now = new Date();
    
    // Filtrer les matchs à venir (statut 'TIMED')
    const upcomingMatches = matches.filter(match => {
      const matchDate = new Date(match.utcDate);
      return matchDate > now && match.status === 'TIMED'; 
    });

    if (upcomingMatches.length === 0) {
      console.log("Aucun match à venir trouvé.");
      return;
    }

    // 1. AUTO-NETTOYAGE : Supprimer tous les anciens matchs de la table
    console.log("Nettoyage de l'ancienne base...");
    const { error: deleteError } = await supabase.from('predictions').delete().neq('id', 0);
    if (deleteError) throw deleteError;

    // 2. AJOUT : Enregistrer les nouveaux matchs
    console.log(`Enregistrement de ${upcomingMatches.length} matchs à venir...`);
    const predictions = upcomingMatches.map(match => ({
      match_id: match.id.toString(),
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
      match_date: match.utcDate,
      prediction: "Analyse en attente", 
      created_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase.from('predictions').insert(predictions);
    if (insertError) throw insertError;

    console.log("Base de données mise à jour avec succès !");
  } catch (error) {
    console.error("Erreur critique :", error.message);
    process.exit(1);
  }
}

runPrediction();

