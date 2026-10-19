(function () {
  "use strict";

  var TAILLE = 4;
  var CLE_MEILLEUR = "biblio-2048-meilleur";
  var NOMS = { gauche: "à gauche", droite: "à droite", haut: "vers le haut", bas: "vers le bas" };
  var TOUCHES = { ArrowLeft: "gauche", ArrowRight: "droite", ArrowUp: "haut", ArrowDown: "bas" };

  var racine = document.getElementById("jeu");
  if (!racine) return;

  // --- Interface ---
  racine.innerHTML =
    '<p class="statut" id="statut" role="status"></p>' +
    '<p class="score" id="score"></p>' +
    '<table class="grille" id="grille">' +
      '<caption class="sr-only">Grille du jeu 2048 : 4 lignes et 4 colonnes</caption><tbody></tbody>' +
    '</table>' +
    '<div class="directions" role="group" aria-label="Directions">' +
      '<button type="button" class="bouton" data-dir="haut"><span aria-hidden="true">↑</span> Haut</button>' +
      '<button type="button" class="bouton" data-dir="gauche"><span aria-hidden="true">←</span> Gauche</button>' +
      '<button type="button" class="bouton" data-dir="bas"><span aria-hidden="true">↓</span> Bas</button>' +
      '<button type="button" class="bouton" data-dir="droite"><span aria-hidden="true">→</span> Droite</button>' +
    '</div>' +
    '<p class="actions-jeu">' +
      '<button type="button" class="bouton" id="lire">Lire la grille</button> ' +
      '<button type="button" class="bouton" id="rejouer">Nouvelle partie</button>' +
    '</p>';

  var statut = document.getElementById("statut");
  var scoreEl = document.getElementById("score");
  var grilleEl = document.getElementById("grille");

  // --- État du jeu ---
  // La grille 4x4 est stockée à plat : 16 nombres, 0 = case vide.
  // La case (ligne r, colonne c) a pour indice r * 4 + c.
  var grille, score, meilleur, gagne, fini, derniereAnnonce = "";

  function lireMeilleur() {
    try { return parseInt(localStorage.getItem(CLE_MEILLEUR), 10) || 0; } catch (e) { return 0; }
  }
  function ecrireMeilleur(v) {
    try { localStorage.setItem(CLE_MEILLEUR, String(v)); } catch (e) {}
  }

  // Un lecteur d'écran n'annonce pas deux fois le même texte de suite :
  // on ajoute une espace insécable pour forcer la relecture.
  function annoncer(texte) {
    if (texte === derniereAnnonce) texte += "\u00A0";
    derniereAnnonce = texte;
    statut.textContent = texte;
  }

  // --- Affichage ---
  function afficher() {
    var corps = grilleEl.tBodies[0];
    corps.innerHTML = "";
    for (var r = 0; r < TAILLE; r++) {
      var tr = document.createElement("tr");
      for (var c = 0; c < TAILLE; c++) {
        var v = grille[r * TAILLE + c];
        var td = document.createElement("td");
        td.setAttribute("data-valeur", v);
        td.innerHTML = v ? String(v) : '<span class="sr-only">vide</span>';
        tr.appendChild(td);
      }
      corps.appendChild(tr);
    }
    scoreEl.textContent = "Score : " + score + " · Meilleur : " + meilleur;
  }

  function lireGrille() {
    var lignes = [];
    for (var r = 0; r < TAILLE; r++) {
      var cases = [];
      for (var c = 0; c < TAILLE; c++) {
        var v = grille[r * TAILLE + c];
        cases.push(v ? v : "vide");
      }
      lignes.push("Ligne " + (r + 1) + " : " + cases.join(", ") + ".");
    }
    annoncer(lignes.join(" "));
  }

  // --- Logique ---

  // Pour une direction, renvoie 4 listes d'indices, chacune lue
  // en partant du bord vers lequel les tuiles glissent.
  function indices(direction) {
    var lignes = [];
    for (var a = 0; a < TAILLE; a++) {
      var ligne = [];
      for (var b = 0; b < TAILLE; b++) {
        var r, c;
        if (direction === "gauche")      { r = a;                c = b; }
        else if (direction === "droite") { r = a;                c = TAILLE - 1 - b; }
        else if (direction === "haut")   { r = b;                c = a; }
        else                             { r = TAILLE - 1 - b;   c = a; }
        ligne.push(r * TAILLE + c);
      }
      lignes.push(ligne);
    }
    return lignes;
  }

  // Fait glisser une ligne vers son début : retire les zéros, fusionne
  // les voisins égaux (une fois chacun), complète avec des zéros.
  function glisser(valeurs) {
    var compactes = valeurs.filter(function (v) { return v !== 0; });
    var resultat = [], fusions = [], i = 0;
    while (i < compactes.length) {
      if (i + 1 < compactes.length && compactes[i] === compactes[i + 1]) {
        var somme = compactes[i] * 2;
        resultat.push(somme);
        fusions.push(somme);
        i += 2;
      } else {
        resultat.push(compactes[i]);
        i += 1;
      }
    }
    while (resultat.length < TAILLE) resultat.push(0);
    return { valeurs: resultat, fusions: fusions };
  }

  function ajouterTuile() {
    var vides = [];
    grille.forEach(function (v, k) { if (!v) vides.push(k); });
    if (!vides.length) return null;
    var k = vides[Math.floor(Math.random() * vides.length)];
    var valeur = Math.random() < 0.9 ? 2 : 4;
    grille[k] = valeur;
    return { valeur: valeur, ligne: Math.floor(k / TAILLE) + 1, colonne: (k % TAILLE) + 1 };
  }

  function peutBouger() {
    for (var k = 0; k < grille.length; k++) {
      if (!grille[k]) return true;
      var c = k % TAILLE, r = Math.floor(k / TAILLE);
      if (c < TAILLE - 1 && grille[k] === grille[k + 1]) return true;
      if (r < TAILLE - 1 && grille[k] === grille[k + TAILLE]) return true;
    }
    return false;
  }

  function deplacer(direction) {
    if (fini) { annoncer("La partie est terminée. Lance une nouvelle partie."); return; }

    var avant = grille.slice();
    var fusions = [];
    indices(direction).forEach(function (ligne) {
      var res = glisser(ligne.map(function (k) { return grille[k]; }));
      res.valeurs.forEach(function (v, n) { grille[ligne[n]] = v; });
      fusions = fusions.concat(res.fusions);
    });

    var aBouge = grille.some(function (v, k) { return v !== avant[k]; });
    if (!aBouge) { annoncer("Rien ne bouge " + NOMS[direction] + "."); return; }

    score += fusions.reduce(function (a, b) { return a + b; }, 0);
    if (score > meilleur) { meilleur = score; ecrireMeilleur(meilleur); }
    var nouvelle = ajouterTuile();
    afficher();

    var morceaux = ["Déplacement " + NOMS[direction] + "."];
    if (fusions.length) morceaux.push((fusions.length > 1 ? "Fusions : " : "Fusion : ") + fusions.join(", ") + ".");
    if (nouvelle) morceaux.push("Nouvelle tuile " + nouvelle.valeur + ", ligne " + nouvelle.ligne + ", colonne " + nouvelle.colonne + ".");
    morceaux.push("Score " + score + ".");

    if (!gagne && grille.indexOf(2048) !== -1) {
      gagne = true;
      morceaux.push("Bravo, tu as atteint 2048 ! Tu peux continuer à jouer.");
    }
    if (!peutBouger()) {
      fini = true;
      morceaux.push("Plus aucun mouvement possible. Partie terminée avec " + score + " points.");
    }
    annoncer(morceaux.join(" "));
  }

  function demarrer() {
    grille = [];
    for (var k = 0; k < TAILLE * TAILLE; k++) grille.push(0);
    score = 0; gagne = false; fini = false;
    meilleur = lireMeilleur();
    ajouterTuile();
    ajouterTuile();
    afficher();
    annoncer("Nouvelle partie. Deux tuiles sont posées. Utilise le bouton « Lire la grille » pour les entendre.");
  }

  // --- Commandes : boutons, clavier, balayage ---
  Array.prototype.forEach.call(racine.querySelectorAll("[data-dir]"), function (b) {
    b.addEventListener("click", function () { deplacer(b.getAttribute("data-dir")); });
  });
  document.getElementById("lire").addEventListener("click", lireGrille);
  document.getElementById("rejouer").addEventListener("click", demarrer);

  // Flèches : seulement quand le focus est dans la zone de jeu, et sans
  // touche modificatrice (VoiceOver utilise Contrôle + Option + flèches).
  racine.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var direction = TOUCHES[e.key];
    if (direction) { e.preventDefault(); deplacer(direction); }
  });

  // Balayage au doigt sur la grille
  var depart = null;
  grilleEl.addEventListener("touchstart", function (e) {
    var t = e.changedTouches[0];
    depart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  grilleEl.addEventListener("touchend", function (e) {
    if (!depart) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - depart.x, dy = t.clientY - depart.y;
    depart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;   // trop court : ce n'est pas un balayage
    if (Math.abs(dx) > Math.abs(dy)) deplacer(dx > 0 ? "droite" : "gauche");
    else deplacer(dy > 0 ? "bas" : "haut");
  }, { passive: true });

  demarrer();
})();
