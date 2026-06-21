const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const axios = require('axios');

// 1. Initialisation sécurisée du client Supabase avec support WebSocket
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

    // 2. Exemple de récupération de données depuis votre API Football
    const response = await axios.get('https://api.football-data.org/v4/matches', {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
    });
    
    const matches = response.data.matches;
    console.log(`Analyse de ${matches.length} matchs en cours...`);

    // 3. Logique de prédiction (À adapter selon vos besoins)
    const predictions = matches.map(match => ({
      match_id: match.id,
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
      prediction: "Victoire domicile", // Exemple simplifié
      created_at: new Date()
    }));

    // 4. Envoi des résultats vers votre base de données Supabase
    const { data, error } = await supabase
      .from('pronostics') // Assurez-vous que le nom de la table est correct
      .insert(predictions);

    if (error) throw error;

    console.log("Pronostics enregistrés avec succès dans Supabase !");
  } catch (error) {
    console.error("Erreur lors de l'exécution :", error.message);
    process.exit(1); // Force l'arrêt en cas d'erreur pour que GitHub Actions le détecte
  }
}

// Lancement
runPrediction();

