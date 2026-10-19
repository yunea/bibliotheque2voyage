(function () {
  "use strict";

  var NIVEAUX = {
    facile: { lignes: 6, colonnes: 6, mines: 6 },
    normal: { lignes: 8, colonnes: 8, mines: 10 }
  };

  var racine = document.getElementById("jeu");
  if (!racine) return;

  // --- Interface ---
  racine.innerHTML =
    '<p class="statut" id="statut" role="status"></p>' +
    '<p class="score" id="info"></p>' +
    '<div class="actions-jeu" role="group" aria-label="Niveau">' +
      '<button type="button" class="bouton" data-niveau="facile" aria-pressed="false">Facile 6×6</button>' +
      '<button type="button" class="bouton" data-niveau="normal" aria-pressed="true">Normal 8×8</button>' +
    '</div>' +
    '<table class="champ" id="champ" role="grid"><caption class="sr-only"></caption><tbody></tbody></table>' +
    '<p class="actions-jeu">' +
      '<button type="button" class="bouton" id="mode" aria-pressed="false">Mode drapeau</button>' +
      '<button type="button" class="bouton" id="rejouer">Nouvelle partie</button>' +
    '</p>';

  var statut = document.getElementById("statut");
  var info = document.getElementById("info");
  var champ = document.getElementById("champ");

  // --- État du jeu ---
  var niveau = "normal";
  var L, C, N;                 // lignes, colonnes, nombre de mines
  var cases = [];              // { mine, compte, etat, bouton } ; etat = cachee | revelee | drapeau
  var etatJeu;                 // attente (aucun clic) | enCours | gagne | perdu
  var courante = 0;            // case atteignable avec Tab (tabindex 0)
  var drapeaux = 0, revelees = 0;
  var modeDrapeau = false;
  var derniereAnnonce = "";

  function annoncer(texte) {
    if (texte === derniereAnnonce) texte += "\u00A0";   // force la relecture d'un texte identique
    derniereAnnonce = texte;
    statut.textContent = texte;
  }

  function position(i) {
    return "ligne " + (Math.floor(i / C) + 1) + ", colonne " + ((i % C) + 1);
  }

  function voisins(i) {
    var r = Math.floor(i / C), c = i % C, liste = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < L && cc >= 0 && cc < C) liste.push(rr * C + cc);
      }
    }
    return liste;
  }

  function melanger(t) {
    for (var i = t.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var x = t[i]; t[i] = t[j]; t[j] = x;
    }
    return t;
  }

  // --- Affichage ---
  function libelle(i) {
    var c = cases[i];
    var base = "Ligne " + (Math.floor(i / C) + 1) + ", colonne " + ((i % C) + 1) + " : ";
    if (c.etat === "drapeau") return base + "drapeau posé";
    if (c.etat === "cachee") return base + "non révélée";
    if (c.mine) return base + "mine";
    if (c.compte === 0) return base + "vide";
    return base + c.compte + (c.compte > 1 ? " mines voisines" : " mine voisine");
  }

  function maj(i) {
    var c = cases[i], b = c.bouton, texte = "";
    b.setAttribute("data-etat", c.etat);
    if (c.etat === "drapeau") texte = "⚑";
    else if (c.etat === "revelee") texte = c.mine ? "✱" : (c.compte ? String(c.compte) : "");
    b.textContent = texte;            // le sens est porté par aria-label, pas par ce symbole
    b.setAttribute("aria-label", libelle(i));
  }

  function majInfo() {
    info.textContent = "Mines restantes : " + (N - drapeaux);
  }

  function construire() {
    var corps = champ.tBodies[0];
    corps.innerHTML = "";
    champ.caption.textContent = "Champ de mines : " + L + " lignes, " + C + " colonnes, " + N + " mines. " +
      "Flèches pour se déplacer, Entrée pour révéler, F pour poser un drapeau.";
    cases = [];
    for (var r = 0; r < L; r++) {
      var tr = document.createElement("tr");
      for (var c = 0; c < C; c++) {
        var i = r * C + c;
        var td = document.createElement("td");
        var b = document.createElement("button");
        b.type = "button";
        b.className = "case";
        b.setAttribute("data-i", i);
        b.tabIndex = (i === courante) ? 0 : -1;
        td.appendChild(b);
        tr.appendChild(td);
        cases.push({ mine: false, compte: 0, etat: "cachee", bouton: b });
      }
      corps.appendChild(tr);
    }
    cases.forEach(function (_, i) { maj(i); });
  }

  // --- Case active (une seule atteignable avec Tab) ---
  function definirCourante(j) {
    if (cases[courante]) cases[courante].bouton.tabIndex = -1;
    courante = j;
    cases[courante].bouton.tabIndex = 0;
  }
  function deplacerFocus(j) {
    definirCourante(j);
    cases[j].bouton.focus();
  }

  // --- Logique ---
  // Les mines sont posées au premier clic, hors de la case choisie et de ses voisines.
  function poserMines(premier) {
    var interdit = [premier].concat(voisins(premier));
    var candidats = [];
    for (var k = 0; k < L * C; k++) if (interdit.indexOf(k) === -1) candidats.push(k);
    melanger(candidats).slice(0, N).forEach(function (k) { cases[k].mine = true; });
    cases.forEach(function (c, k) {
      c.compte = voisins(k).filter(function (v) { return cases[v].mine; }).length;
    });
  }

  // Révèle une case ; si elle est vide (0 mine voisine), révèle aussi ses voisines,
  // de proche en proche. On utilise une pile plutôt qu'un appel récursif.
  function propager(depart) {
    var pile = [depart], n = 0;
    while (pile.length) {
      var k = pile.pop();
      var c = cases[k];
      if (c.etat !== "cachee" || c.mine) continue;
      c.etat = "revelee";
      revelees++; n++;
      maj(k);
      if (c.compte === 0) voisins(k).forEach(function (v) { pile.push(v); });
    }
    return n;
  }

  function perdre(i) {
    etatJeu = "perdu";
    cases.forEach(function (c, k) {
      if (c.mine && c.etat === "cachee") { c.etat = "revelee"; maj(k); }
    });
    cases[i].bouton.setAttribute("data-explose", "true");
    annoncer("Boum ! Mine en " + position(i) + ". Partie perdue. Lance une nouvelle partie pour rejouer.");
  }

  function gagner() {
    etatJeu = "gagne";
    cases.forEach(function (c, k) {
      if (c.mine && c.etat === "cachee") { c.etat = "drapeau"; drapeaux++; maj(k); }
    });
    majInfo();
    annoncer("Gagné ! Toutes les cases sans mine sont découvertes.");
  }

  function partieFinie() {
    if (etatJeu === "gagne" || etatJeu === "perdu") {
      annoncer("La partie est terminée. Lance une nouvelle partie.");
      return true;
    }
    return false;
  }

  function reveler(i) {
    if (partieFinie()) return;
    var c = cases[i];
    if (c.etat === "drapeau") { annoncer("Cette case porte un drapeau. Retire-le d'abord."); return; }
    if (c.etat === "revelee") { annoncer("Case déjà révélée."); return; }

    if (etatJeu === "attente") { poserMines(i); etatJeu = "enCours"; }
    if (c.mine) { perdre(i); return; }

    var n = propager(i);
    if (revelees === L * C - N) { gagner(); return; }

    var phrase = c.compte === 0 ? "vide" : c.compte + (c.compte > 1 ? " mines voisines" : " mine voisine");
    var texte = "Ligne " + (Math.floor(i / C) + 1) + ", colonne " + ((i % C) + 1) + " : " + phrase + ".";
    if (n > 1) texte += " " + n + " cases révélées.";
    annoncer(texte);
  }

  function basculerDrapeau(i) {
    if (partieFinie()) return;
    var c = cases[i];
    if (c.etat === "revelee") { annoncer("Case déjà révélée : impossible d'y poser un drapeau."); return; }
    if (c.etat === "cachee") { c.etat = "drapeau"; drapeaux++; }
    else { c.etat = "cachee"; drapeaux--; }
    maj(i);
    majInfo();
    annoncer((c.etat === "drapeau" ? "Drapeau posé " : "Drapeau retiré ") + position(i) +
             ". Mines restantes : " + (N - drapeaux) + ".");
  }

  function demarrer() {
    var n = NIVEAUX[niveau];
    L = n.lignes; C = n.colonnes; N = n.mines;
    etatJeu = "attente"; drapeaux = 0; revelees = 0; courante = 0;
    construire();
    majInfo();
    annoncer("Nouvelle partie, niveau " + niveau + " : " + L + " par " + C + ", " + N +
             " mines. Ton premier choix est toujours sûr.");
  }

  // --- Commandes ---
  champ.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-i]");
    if (!b) return;
    var i = parseInt(b.getAttribute("data-i"), 10);
    if (modeDrapeau) basculerDrapeau(i); else reveler(i);
  });

  // Clic droit (ou appui long selon le navigateur) : drapeau
  champ.addEventListener("contextmenu", function (e) {
    var b = e.target.closest("button[data-i]");
    if (!b) return;
    e.preventDefault();
    basculerDrapeau(parseInt(b.getAttribute("data-i"), 10));
  });

  // Quand une case reçoit le focus (clavier ou clic), elle devient la case active
  champ.addEventListener("focusin", function (e) {
    var b = e.target.closest("button[data-i]");
    if (b) definirCourante(parseInt(b.getAttribute("data-i"), 10));
  });

  // Flèches, Début/Fin et F
  champ.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var b = e.target.closest("button[data-i]");
    if (!b) return;
    var i = parseInt(b.getAttribute("data-i"), 10);
    var r = Math.floor(i / C), c = i % C, cible = null;

    if (e.key === "ArrowLeft")       cible = c > 0 ? i - 1 : i;
    else if (e.key === "ArrowRight") cible = c < C - 1 ? i + 1 : i;
    else if (e.key === "ArrowUp")    cible = r > 0 ? i - C : i;
    else if (e.key === "ArrowDown")  cible = r < L - 1 ? i + C : i;
    else if (e.key === "Home")       cible = r * C;
    else if (e.key === "End")        cible = r * C + C - 1;

    if (cible !== null) { e.preventDefault(); deplacerFocus(cible); return; }
    if (e.key === "f" || e.key === "F") { e.preventDefault(); basculerDrapeau(i); }
  });

  document.getElementById("mode").addEventListener("click", function () {
    modeDrapeau = !modeDrapeau;
    this.setAttribute("aria-pressed", modeDrapeau ? "true" : "false");
    annoncer(modeDrapeau ? "Mode drapeau activé : un choix pose ou retire un drapeau."
                         : "Mode drapeau désactivé : un choix révèle la case.");
  });

  document.getElementById("rejouer").addEventListener("click", demarrer);

  Array.prototype.forEach.call(racine.querySelectorAll("[data-niveau]"), function (b) {
    b.addEventListener("click", function () {
      niveau = b.getAttribute("data-niveau");
      Array.prototype.forEach.call(racine.querySelectorAll("[data-niveau]"), function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      demarrer();
    });
  });

  demarrer();
})();
