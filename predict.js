const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY, 
  { realtime: { transport: WebSocket } }
);

// Liste des 12 codes de compétitions incluses dans l'offre gratuite de l'API
const FREE_COMPETITIONS = [
  'WC',   // Coupe du Monde
  'CL',   // Champions League
  'BL1',  // Bundesliga (Allemagne)
  'DED',  // Eredivisie (Pays-Bas)
  'FL1',  // Ligue 1 (France)
  'PD',   // La Liga (Espagne)
  'SA',   // Serie A (Italie)
  'PL',   // Premier League (Angleterre)
  'ELI',  // Championship (Angleterre)
  'PPL',  // Primeira Liga (Portugal)
  'EC',   // Championnat d'Europe (Euro)
  'BSA'   // Serie A (Brésil)
];

async function runPrediction() {
  try {
    console.log("Démarrage du scan des 12 compétitions gratuites AFRISTATS...");
    let allUpcomingMatches = [];
    const now = new Date();

    // Boucle sur chaque compétition autorisée
    for (const comp of FREE_COMPETITIONS) {
      try {
        console.log(`Vérification de la compétition : ${comp}`);
        const response = await axios.get(`https://api.football-data.org/v4/competitions/${comp}/matches`, {
          headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
        });

        const matches = response.data.matches || [];
        
        // On filtre pour ne garder que les matchs à venir de cette ligue
        const filtered = matches.filter(match => {
          const matchDate = new Date(match.utcDate);
          return matchDate > now && (match.status === 'TIMED' || match.status === 'SCHEDULED');
        });

        allUpcomingMatches = allUpcomingMatches.concat(filtered);
        
        // Petite pause pour éviter de bloquer la clé API (limite de requêtes par minute)
        await new Promise(resolve => setTimeout(resolve, 6000)); 

      } catch (e) {
        // Si une compétition n'est pas active ou s'il y a une erreur, on passe à la suivante sans planter
        console.log(`Compétition ${comp} non disponible actuellement ou erreur.`);
      }
    }

    console.log(`Nombre total de matchs à venir trouvés sur l'ensemble des ligues : ${allUpcomingMatches.length}`);

    if (allUpcomingMatches.length === 0) {
      console.log("Aucun match à venir aujourd'hui dans les ligues gratuites.");
      return;
    }

    // 1. Enregistrement des nouveaux matchs
    const predictions = allUpcomingMatches.map(match => ({
      match_id: match.id.toString(),
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
      match_date: match.utcDate,
      prediction: "Analyse IA en cours", 
      created_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase.from('predictions').insert(predictions);
    if (insertError) throw insertError;

    console.log("Tous les pronostics du jour ont été enregistrés avec succès !");
  } catch (error) {
    console.error("Erreur générale :", error.message);
    process.exit(1);
  }
}

runPrediction();

