// Configuration et État du Jeu
let joueurs = [];
let indexJoueurActuel = 0;
let phaseJeu = "normal"; // "normal" ou "penalite"
let desPaiementRequis = 0;
let ciblePenaliteIndex = null;
let desGarderCeTour = [];
let desDisponibles = 6;
let desLances = [];

// Enregistrement du Service Worker pour la PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log(err));
}

// Initialisation des champs de saisie des prénoms
document.getElementById('nb-joueurs').addEventListener('change', (e) => {
    const container = document.getElementById('players-input-container');
    container.innerHTML = '';
    const nb = parseInt(e.target.value);
    for(let i=1; i<=nb; i++) {
        container.innerHTML += `<input type="text" id="p${i}" placeholder="Joueur ${i}" required><br>`;
    }
});
document.getElementById('nb-joueurs').dispatchEvent(new Event('change'));

// Lancement du jeu
document.getElementById('btn-start').addEventListener('click', () => {
    const nb = parseInt(document.getElementById('nb-joueurs').value);
    joueurs = [];
    for(let i=1; i<=nb; i++) {
        const name = document.getElementById(`p${i}`).value || `Joueur ${i}`;
        joueurs.push({ name: name, score: 30, victoires: 0, elimine: false });
    }
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    initialiserTour();
    genererTableau();
});

function genererTableau() {
    const board = document.getElementById('score-board');
    board.innerHTML = '';

    joueurs.forEach((j, joueurIdx) => {
        if (j.elimine) return;

        let actifClass = (joueurIdx === indexJoueurActuel) ? 'colonne-active' : '';
        
        let html = `
            <div class="gabarit-colonne ${actifClass}" id="col-j-${joueurIdx}">
                <div class="gabarit-header">${j.name}</div>
                <div class="gabarit-body" id="body-j-${joueurIdx}">
                    <!-- Le pion physique sera injecté dynamiquement ici -->
                    <div class="pion-score" id="pion-j-${joueurIdx}"></div>
        `;

        // Génération du gabarit par rangées (30/29, 28/27, etc.)
        for (let scoreMax = 30; scoreMax >= 0; scoreMax -= 2) {
            let nGauche = scoreMax;
            let nDroite = scoreMax - 1;

            html += `<div class="gabarit-row" id="row-${joueurIdx}-${nGauche}">`;
            
            // Case de gauche (Chiffres pairs)
            html += `<div class="gabarit-cell gauche">${nGauche}</div>`;
            
            // Case de droite (Chiffres impairs, sauf si inférieur à 0)
            if (nDroite >= 0) {
                html += `<div class="gabarit-cell droite">${nDroite}</div>`;
            } else {
                html += `<div class="gabarit-cell droite"></div>`;
            }
            
            html += `</div>`;
        }

        html += `
                </div>
                <div class="gabarit-footer">Nb victoires : ${j.victoires}</div>
            </div>
        `;

        board.innerHTML += html;
    });

    // Forcer le calcul du placement des pions après affichage
    setTimeout(actualiserPositionPions, 50);
}

function actualiserPositionPions() {
    joueurs.forEach((j, joueurIdx) => {
        if (j.elimine) return;

        const pion = document.getElementById(`pion-j-${joueurIdx}`);
        const scoreCible = j.score;

        // Trouver la rangée parente (indexée par le chiffre pair associé)
        const lignePaire = (scoreCible % 2 === 0) ? scoreCible : scoreCible + 1;
        const rowEl = document.getElementById(`row-${joueurIdx}-${lignePaire}`);
        const bodyEl = document.getElementById(`body-j-${joueurIdx}`);

        if (rowEl && pion && bodyEl) {
            // Calcul top par rapport au conteneur de la colonne
            let topPos = rowEl.offsetTop + (rowEl.offsetHeight / 2) - 16; 
            
            // Centrage horizontal selon pair (gauche) ou impair (droite)
            let leftPos = 0;
            if (scoreCible % 2 === 0) {
                leftPos = (rowEl.offsetWidth / 4) - 16; // Centre de la moitié gauche
            } else {
                leftPos = (3 * rowEl.offsetWidth / 4) - 16; // Centre de la moitié droite
            }

            // Application des styles pour déclencher l'animation fluide CSS
            pion.style.top = `${topPos}px`;
            pion.style.left = `${leftPos}px`;
            
            // Si le pion change de couleur pour le joueur actif
            pion.style.background = (joueurIdx === indexJoueurActuel) 
                ? "radial-gradient(circle at 30% 30%, #66ff66, #006600)" // Vert pour le joueur actif
                : "radial-gradient(circle at 30% 30%, #ff4d4d, #990000)"; // Rouge pour les autres
        }
    });
}

function genererHTMLDes(valeur, estGarde, index) {
    // Schémas de positionnement des points (pips) sur une grille 3x3 pour chaque face
    const configurationFaces = {
        1: [4],
        2: [0, 8],
        3: [0, 4, 8],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    };

    let pipsHtml = '';
    const pointsActifs = configurationFaces[valeur];

    // Générer les 9 sous-cases du dé
    for (let i = 0; i < 9; i++) {
        if (pointsActifs.includes(i)) {
            pipsHtml += `<div class="pip"></div>`;
        } else {
            pipsHtml += `<div></div>`;
        }
    }

    let classeGarde = estGarde ? 'kept' : '';
    return `<div class="real-die ${classeGarde}" onclick="basculerDes(${index}, this)">${pipsHtml}</div>`;
}

function initialiserTour() {
    desGarderCeTour = [];
    desDisponibles = 6;
    document.getElementById('current-player-name').innerText = joueurs[indexJoueurActuel].name;
    document.getElementById('btn-roll').disabled = false;
    document.getElementById('btn-end-turn').disabled = true;
    document.getElementById('turn-status').innerText = "Lancez les 6 dés.";
    document.getElementById('dice-container').innerHTML = '';
}

// Gestion des lancers de dés
// Gestion graphique du lancer de dés
document.getElementById('btn-roll').addEventListener('click', () => {
    const container = document.getElementById('dice-container');
    container.innerHTML = '';
    desLances = [];

    for (let i = 0; i < desDisponibles; i++) {
        let val = Math.floor(Math.random() * 6) + 1;
        desLances.push({ value: val, kept: false });
        
        // Génération du dé visuel avec ses points noirs (pips)
        let divTemporaire = document.createElement('div');
        divTemporaire.innerHTML = genererHTMLDes(val, false, i);
        let dieEl = divTemporaire.firstElementChild;
        
        container.appendChild(dieEl);
    }
    document.getElementById('btn-roll').disabled = true;
});

function basculerDes(idx, el) {
    if (phaseJeu === "normal") {
        desLances[idx].kept = !desLances[idx].kept;
        el.classList.toggle('kept');
        
        let auMoinsUnGarde = desLances.some(d => d.kept);
        document.getElementById('btn-end-turn').disabled = !auMoinsUnGarde;
    }
}

// Validation de la sélection ou fin du tour
document.getElementById('btn-end-turn').addEventListener('click', () => {
    let gardes = desLances.filter(d => d.kept).map(d => d.value);
    desGarderCeTour = desGarderCeTour.concat(gardes);
    desDisponibles -= gardes.length;

    if (desDisponibles > 0) {
        document.getElementById('btn-roll').disabled = false;
        document.getElementById('btn-end-turn').disabled = true;
        document.getElementById('dice-container').innerHTML = '';
        document.getElementById('turn-status').innerText = `Dés restants : ${desDisponibles}. Relancez.`;
    } else {
        traiterResultatFinTour();
    }
});

function traiterResultatFinTour() {
    let total = desGarderCeTour.reduce((a, b) => a + b, 0);
    let joueur = joueurs[indexJoueurActuel];

    if (total < 30) {
        let perte = 30 - total;
        joueur.score = Math.max(0, joueur.score - perte);
        if(joueur.score === 0) joueur.elimine = true;
        passerAuJoueurSuivant();
    } else if (total === 30) {
        passerAuJoueurSuivant();
    } else {
        // Règle des pénalités (31 et +)
        desPaiementRequis = total - 30;
        let direction = (total % 2 !== 0) ? -1 : 1; // Impair = Gauche (-1), Pair = Droite (+1)
        ciblePenaliteIndex = calculerProchainJoueurVivant(indexJoueurActuel, direction);
        
        alert(`${joueur.name} fait un score de ${total} ! Phase d'attaque ciblée sur le joueur à sa ${(direction === -1)?'gauche':'droite'}.`);
        // Ici, implémenter la logique de relance pour la pénalité selon vos règles
        passerAuJoueurSuivant(); 
    }
}

function calculerProchainJoueurVivant(actuel, direction) {
    let idx = (actuel + direction + joueurs.length) % joueurs.length;
    while(joueurs[idx].elimine) {
        idx = (idx + direction + joueurs.length) % joueurs.length;
    }
    return idx;
}

function passerAuJoueurSuivant() {
    genererTableau();
    // Vérification fin de partie
    let vivants = joueurs.filter(j => !j.elimine);
    if (vivants.length === 1) {
        alert(`Victoire de ${vivants[0].name} !`);
        vivants[0].victoires++;
        return;
    }
    
    do {
        indexJoueurActuel = (indexJoueurActuel + 1) % joueurs.length;
    } while (joueurs[indexJoueurActuel].elimine);
    
    initialiserTour();
}