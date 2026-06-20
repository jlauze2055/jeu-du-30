// --- VARIABLES D'ÉTAT DE L'APPLICATION ---
let players = []; 
let currentRound = 1;
let currentIndex = 0; 
let firstPlayerOfRoundIndex = 0; 
// États pour gérer les pénalités complexes en cascade
let penaltyState = { active: false, targetIndex: -1, faceValue: 0, diceRemaining: 0, direction: "" };
// Historique pour l'annulation (Undo) du dernier coup joué
let historyState = null;

// Éléments DOM
const scrConfig = document.getElementById('screen-config');
const scrGame = document.getElementById('screen-game');
const gridContainer = document.getElementById('scoreboard-grid');
const stepRoll6 = document.getElementById('step-roll-6');
const stepPenalty = document.getElementById('step-penalty');
const labelPenaltyText = document.getElementById('label-penalty-text');
const valTotal6 = document.getElementById('input-total-6');
const valDiceCount = document.getElementById('input-dice-count');
const displayRound = document.getElementById('display-round-id');
const displayCurrentPlayerName = document.getElementById('display-current-player');
const systemMessage = document.getElementById('system-message');
const btnNextRound = document.getElementById('btn-next-round');
const btnUndo = document.getElementById('btn-undo');

// Enregistrement du Service Worker avec rechargement automatique si mise à jour
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
  .then((reg) => {
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          window.location.reload();
        }
      });
    });
  })
  .catch(() => {});
}

// --- CONFIGURATION INITIALE & LANCEMENT ---
document.getElementById('btn-start').addEventListener('click', () => {
  const p1 = document.getElementById('p1').value.trim();
  const p2 = document.getElementById('p2').value.trim();
  
  if (!p1 || !p2) { 
    alert("Les deux premiers joueurs sont obligatoires."); 
    return; 
  }
  
  players = [];
  for (let i = 1; i <= 8; i++) {
    const name = document.getElementById(`p${i}`).value.trim();
    if (name) { 
      players.push({ name: name, score: 30, wins: 0 }); 
    }
  }

  currentRound = 1;
  firstPlayerOfRoundIndex = 0;
  historyState = null;
  startRound();
  scrConfig.classList.add('hidden');
  scrGame.classList.remove('hidden');
});

// --- ENCLENCHEMENT D'UNE MANCHE ---
function startRound() {
  players.forEach(p => p.score = 30);
  currentIndex = firstPlayerOfRoundIndex;
  penaltyState.active = false;
  
  displayRound.textContent = currentRound;
  systemMessage.textContent = "";
  btnNextRound.classList.add('hidden');
  
  resetActionInputs();
  renderGridScoreboard();
  updateActiveTurnDisplay();
}

// Mémorise l'état actuel avant une action pour permettre l'annulation
function saveToHistory() {
  historyState = {
    players: JSON.parse(JSON.stringify(players)),
    currentRound: currentRound,
    currentIndex: currentIndex,
    firstPlayerOfRoundIndex: firstPlayerOfRoundIndex,
    penaltyState: JSON.parse(JSON.stringify(penaltyState)),
    systemMessageText: systemMessage.textContent
  };
}

// --- DESSIN DE LA GRILLE VISUELLE (3x3) ---
function renderGridScoreboard() {
  gridContainer.innerHTML = '';
  
  players.forEach((p, idx) => {
    const cell = document.createElement('div');
    cell.className = `grid-cell`;
    cell.setAttribute('data-pos', idx + 1);
    
    if (p.score <= 0) {
      cell.classList.add('eliminated');
    } else if (idx === currentIndex && p.score > 0) {
      cell.classList.add('active'); 
    }
    
    // Gestion dynamique de l'affichage textuel du pluriel des victoires
    let winsHTML = '';
    const roundedWins = Math.round(p.wins);
    if (roundedWins === 1) {
      winsHTML = `<div class="cell-wins">1 victoire</div>`;
    } else if (roundedWins > 1) {
      winsHTML = `<div class="cell-wins">${roundedWins} victoires</div>`;
    }
    
    cell.innerHTML = `
      <div class="cell-name">${p.name}</div>
      <div class="cell-score">${Math.round(p.score)}</div>
      ${winsHTML}
    `;
    gridContainer.appendChild(cell);
  });
}


function updateActiveTurnDisplay() {
  if (players[currentIndex].score <= 0) { 
    moveToNextLivePlayer(); 
    return; 
  }
  displayCurrentPlayerName.textContent = players[currentIndex].name;
  renderGridScoreboard();
}

function resetActionInputs() {
  stepRoll6.classList.remove('hidden');
  stepPenalty.classList.add('hidden');
  valTotal6.value = '';
  valDiceCount.value = '';
}

// --- SOUMISSION ACTION 1 : LANCER INITIAL (6 DÉS) ---
document.getElementById('btn-submit-6').addEventListener('click', () => {
  const total = parseInt(valTotal6.value);
  if (isNaN(total) || total < 6 || total > 36) { 
    alert("Veuillez entrer un total valide entre 6 et 36."); 
    return; 
  }
  
  saveToHistory();
  systemMessage.textContent = ""; 
  let currPlayer = players[currentIndex];
  
  if (total === 30) {
    moveToNextLivePlayer();
  } else if (total < 30) {
    let loss = 30 - total;
    currPlayer.score = Math.max(0, Math.round(currPlayer.score - loss));
    if (currPlayer.score === 0) {
      systemMessage.textContent = `${currPlayer.name} est éliminé(e) ! (-${loss} pts)`;
    }
    moveToNextLivePlayer();
  } else {
    // 31, 33, 35 -> Gauche | 32, 34, 36 -> Droite
    let direction = [31, 33, 35].includes(total) ? "gauche" : "droite";
    let face = total - 30;
    
    let target = findTargetIndex(currentIndex, direction);
    if (target === -1) {
      moveToNextLivePlayer();
      return;
    }
    
    penaltyState = { active: true, targetIndex: target, faceValue: face, diceRemaining: 0, direction: direction };
    
    stepRoll6.classList.add('hidden');
    stepPenalty.classList.remove('hidden');
    labelPenaltyText.textContent = `Dés de pénalité (${face} attendu)`;
    valDiceCount.placeholder = `Saisie entre 0 et 99`;
  }
});

// --- SOUMISSION ACTION 2 : PÉNALITÉ ---
document.getElementById('btn-submit-penalty').addEventListener('click', () => {
  const count = parseInt(valDiceCount.value);
  if (isNaN(count) || count < 0 || count > 99) { 
    alert("Veuillez inscrire un nombre de dés tirés entre 0 et 99."); 
    return; 
  }
  
  saveToHistory();
  applyCascadePenalty();
});

function applyCascadePenalty() {
  const count = parseInt(valDiceCount.value);
  penaltyState.diceRemaining = count;
  let penaltyReports = [];
  
  while (penaltyState.diceRemaining > 0 && penaltyState.targetIndex !== -1) {
    let target = players[penaltyState.targetIndex];
    let damagePerDie = penaltyState.faceValue;
    
    let initialScore = Math.round(target.score);
    let maximumPossibleDamage = penaltyState.diceRemaining * damagePerDie;
    
    target.score = Math.max(0, Math.round(target.score - maximumPossibleDamage));
    
    let pointsLost = Math.round(initialScore - target.score);
    let diceUsed = Math.round(pointsLost / damagePerDie);
    penaltyState.diceRemaining = Math.max(0, Math.round(penaltyState.diceRemaining - diceUsed));
    
    if (target.score === 0) {
      penaltyReports.push(`${target.name} éliminé(e) (-${pointsLost} pts)`);
      penaltyState.targetIndex = findTargetIndex(penaltyState.targetIndex, penaltyState.direction);
    } else {
      penaltyReports.push(`${target.name} perd ${pointsLost} pts`);
    }
  }
  
  if (penaltyReports.length > 0) {
    systemMessage.textContent = `Pénalité : ${penaltyReports.join(', ')}.`;
  }
  
  penaltyState.active = false;
  resetActionInputs();
  moveToNextLivePlayer();
}

// Trouver le joueur vivant à gauche ou à droite, EXCLUANT le lanceur initial
function findTargetIndex(startIdx, direction) {
  let step = direction === "gauche" ? 1 : -1;
  let len = players.length;
  let checkIdx = (startIdx + step + len) % len;
  
  while (checkIdx !== startIdx) {
    // RÈGLE : Ne pas cibler le joueur actif qui a lancé les dés pour cette pénalité
    if (players[checkIdx].score > 0 && checkIdx !== currentIndex) { 
      return checkIdx; 
    }
    checkIdx = (checkIdx + step + len) % len;
  }
  return -1; 
}

// --- CYCLE DES TOURS ---
function moveToNextLivePlayer() {
  renderGridScoreboard();
  
  let alivePlayers = players.filter(p => p.score > 0);
  
  if (alivePlayers.length <= 1) {
    endRound(alivePlayers[0]);
    return;
  }
  
  let len = players.length;
  let attempts = 0;
  do {
    currentIndex = (currentIndex + 1) % len;
    attempts++;
  } while (players[currentIndex].score <= 0 && attempts < len);

  updateActiveTurnDisplay();
}

// --- FIN DE MANCHE & ATTRIBUTION DES VICTOIRES ---
function endRound(alivePlayersArray) {
  let winnerIndex = -1;

  // L'argument reçu est un tableau filtré des survivants
  if (alivePlayersArray && alivePlayersArray.length > 0) {
    let winner = alivePlayersArray[0];
    winner.wins = Math.round(winner.wins + 1);
    systemMessage.textContent = `Fin de la manche ! Victoire de ${winner.name}.`;
    
    // Recherche de l'index du vainqueur dans le tableau d'origine (contenant tous les joueurs)
    winnerIndex = players.findIndex(p => p.name === winner.name);
  } else {
    systemMessage.textContent = "Fin de la manche ! Aucun survivant.";
  }
  
  // RÈGLE REFORMULÉE : Premier joueur = joueur (actif ou non) immédiatement à gauche (+1) du vainqueur
  if (winnerIndex !== -1) {
    firstPlayerOfRoundIndex = (winnerIndex + 1) % players.length;
  } else {
    firstPlayerOfRoundIndex = (firstPlayerOfRoundIndex + 1) % players.length;
  }
  
  currentRound++;
  
  btnNextRound.classList.remove('hidden');
  stepRoll6.classList.add('hidden');
  stepPenalty.classList.add('hidden');
}

btnNextRound.addEventListener('click', () => {
  startRound();
});

// --- REBOBINAGE (UNDO) ---
btnUndo.addEventListener('click', () => {
  if (!historyState) {
    alert("Aucune action à annuler.");
    return;
  }
  
  players = historyState.players;
  currentRound = historyState.currentRound;
  currentIndex = historyState.currentIndex;
  firstPlayerOfRoundIndex = historyState.firstPlayerOfRoundIndex;
  penaltyState = historyState.penaltyState;
  systemMessage.textContent = historyState.systemMessageText;
  
  displayRound.textContent = currentRound;
  
  if (penaltyState.active) {
    stepRoll6.classList.add('hidden');
    stepPenalty.classList.remove('hidden');
    labelPenaltyText.textContent = `Dés de pénalité (${penaltyState.faceValue} attendu)`;
    valDiceCount.placeholder = `Saisie entre 0 et 99`;
    valDiceCount.value = '';
  } else {
    resetActionInputs();
  }
  
  historyState = null; 
  renderGridScoreboard();
  displayCurrentPlayerName.textContent = players[currentIndex].name;
});
