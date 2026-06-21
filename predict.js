const { createClient } = require('@supabase/supabase-js');

// Récupération des clés d'accès sécurisées depuis GitHub
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Liste des compétitions autorisées (Plan gratuit)
const LIGUES_AUTORISEES = ['PL', 'CL', 'FL1', 'PD', 'ELC', 'SB'];

const attendre = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- LE CERVEAU DE L'IA : PRONOSTIC BASÉ SUR LE CLASSEMENT ---
function calculerPronoIntelligent(positionDom, positionExt) {
  // Par défaut, si pas de classement (ex: Matchs de Coupe ou Internationaux sans tableau)
  let maxButsDom = 2;
  let maxButsExt = 2;

  // Si on a les positions réelles, on ajuste les forces
  if (positionDom !== null && positionExt !== null) {
    const ecart = positionExt - positionDom; // Un écart positif signifie que l'équipe Dom est mieux classée (ex: 3ème vs 15ème -> 15-3 = 12)

    if (ecart > 8) {
      // Domicile ultra favori
      maxButsDom = 4;
      maxButsExt = 1;
    } else if (ecart > 3) {
      // Domicile favori
      maxButsDom = 3;
      maxButsExt = 1;
    } else if (ecart < -8) {
      // Extérieur ultra favori
      maxButsDom = 1;
      maxButsExt = 4;
    } else if (ecart < -3) {
      // Extérieur favori
      maxButsDom = 1;
      maxButsExt = 3;
    }
  } else {
    // Bonus historique de base pour l'équipe à domicile si aucune donnée sur le niveau
    maxButsDom = 3;
    maxButsExt = 2;
  }

  // Génération du score selon les limites intelligentes calculées
  const butsDom = Math.floor(Math.random() * maxButsDom);
  const butsExt = Math.floor(Math.random() * maxButsExt);

  let prono = "Match Nul (N)";
  if (butsDom > butsExt) prono = "Victoire Domicile (1)";
  if (butsDom < butsExt) prono = "Victoire Extérieur (2)";

  // Sécurité bonus pour les gros favoris si le hasard donne un score nul
  if (positionDom !== null && positionExt !== null) {
    if (positionExt - positionDom > 10 && butsDom === butsExt) {
      return { score: `${butsDom + 1} - ${butsExt}`, prono: "Victoire Domicile (1)" };
    }
    if (positionDom - positionExt > 10 && butsDom === butsExt) {
      return { score: `${butsDom} - ${butsExt + 1}`, prono: "Victoire Extérieur (2)" };
    }
  }

  return { score: `${butsDom} - ${butsExt}`, prono: prono };
}

async function executer() {
  const aujourdhui = new Date().toISOString().split('T')[0];
  console.log(`[IA AFRISTATS PRONO] Analyse intelligente pour le : ${aujourdhui}`);
  
  try {
    await supabase.from('vip_matches').delete().neq('id', 0);
    console.log("[IA] Table VIP nettoyée.");
  } catch (err) {
    console.error("Erreur nettoyage :", err.message);
  }

  for (const ligue of LIGUES_AUTORISEES) {
    try {
      // 1. ÉTAPE D'INTELLIGENCE : On récupère le classement actuel de la ligue
      console.log(`📊 Récupération du classement pour la ligue : ${ligue}`);
      const standingRes = await fetch(`https://api.football-data.org/v4/competitions/${ligue}/standings`, {
        headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY }
      });
      const standingData = await standingRes.json();
      
      // On crée un dictionnaire pour lire instantanément la place d'une équipe par son nom
      const classementMap = {};
      if (standingData.standings && standingData.standings[0] && standingData.standings[0].table) {
        standingData.standings[0].table.forEach(item => {
          classementMap[item.team.name] = item.position;
        });
      }

      await attendre(6000); // Pause pour respecter le quota après l'appel au classement

      // 2. Récupération des matchs du jour
      const response = await fetch(`https://api.football-data.org/v4/competitions/${ligue}/matches?dateFrom=${aujourdhui}&dateTo=${aujourdhui}`, {
        headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY }
      });
      const data = await response.json();

      if (data.matches && data.matches.length > 0) {
        for (const match of data.matches) {
          const nomDom = match.homeTeam.name;
          const nomExt = match.awayTeam.name;

          // On cherche leur position dans notre dictionnaire (renvoie null si introuvable)
          const posDom = classementMap[nomDom] || null;
          const posExt = classementMap[nomExt] || null;

          // L'IA utilise la fonction intelligente basée sur le classement
          const resultatIA = calculerPronoIntelligent(posDom, posExt);

          // Insertion dans Supabase
          await supabase.from('vip_matches').insert({
            heure: match.utcDate.split('T')[1].substring(0, 5),
            championnat: match.competition.name,
            equipe_domicile: nomDom,
            equipe_exterieur: nomExt,
            prono: resultatIA.prono,
            score_exact: resultatIA.score
          });
          
          console.log(`🧠 [Prono IA] ${nomDom} (${posDom || '?'}) vs ${nomExt} (${posExt || '?'}) -> Résultat : ${resultatIA.score} [${resultatIA.prono}]`);
        }
      } else {
        console.log(`ℹ️ Aucun match aujourd'hui pour la ligue : ${ligue}`);
      }
    } catch (err) {
      console.error(`❌ Erreur ligue ${ligue}:`, err.message);
    }

    console.log(`⏱️ Pause de sécurité...`);
    await attendre(6000);
  }
  console.log("[IA] Fin du traitement intelligent.");
}

executer();

