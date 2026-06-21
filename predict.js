const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const axios = require('axios');

// 1. Initialisation sécurisée du client Supabase
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY, 
  {
    realtime: {
      transport: WebSocket
    }
  }
);

async function runPrediction() {
  try {
    console.log("Démarrage de l'algorithme intelligent AFRISTATS...");

    // 2. Récupération des données
    const response = await axios.get('https://api.football-data.org/v4/matches', {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
    });
    
    const matches = response.data.matches;
    
    // 3. Filtrage : ne garder que les matchs dont la date est future
    const now = new Date();
    const upcomingMatches = matches.filter(match => {
      const matchDate = new Date(match.utcDate);
      return matchDate > now;
    });

    console.log(`Analyse de ${upcomingMatches.length} matchs à venir...`);

    if (upcomingMatches.length === 0) {
      console.log("Aucun match à venir trouvé.");
      return;
    }

    // 4. Préparation des données pour la table 'predictions'
    const predictions = upcomingMatches.map(match => ({
      match_id: match.id.toString(),
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
      match_date: match.utcDate,
      prediction: "Analyse en attente", 
      created_at: new Date().toISOString()
    }));

    // 5. Envoi vers Supabase (table 'predictions')
    const { data, error } = await supabase
      .from('predictions')
      .insert(predictions);

    if (error) throw error;

    console.log("Pronostics enregistrés avec succès dans Supabase !");
  } catch (error) {
    console.error("Erreur lors de l'exécution :", error.message);
    process.exit(1);
  }
}

// Lancement
runPrediction();

