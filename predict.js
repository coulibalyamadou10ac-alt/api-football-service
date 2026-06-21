const axios = require('axios');

async function debugMatches() {
  try {
    const response = await axios.get('https://api.football-data.org/v4/matches', {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
    });
    
    const matches = response.data.matches;
    console.log("--- DIAGNOSTIC DE L'API ---");
    console.log("Nombre total de matchs trouvés :", matches.length);
    
    // On affiche le statut et la date des 5 premiers matchs
    matches.slice(0, 5).forEach((m, index) => {
      console.log(`Match ${index + 1}: ${m.homeTeam.name} vs ${m.awayTeam.name} | Statut: ${m.status} | Date: ${m.utcDate}`);
    });
    
  } catch (error) {
    console.error("Erreur API :", error.message);
  }
}

debugMatches();

