(function () {
  "use strict";

  // Les 8 paires : un symbole et son nom (le nom sera lu par VoiceOver)
  var ELEMENTS = [
    ["☾", "Lune"], ["☀", "Soleil"], ["★", "Étoile"], ["♥", "Cœur"],
    ["♣", "Trèfle"], ["♪", "Note"], ["✿", "Fleur"], ["⚓", "Ancre"]
  ];
  var COLONNES = 4;

  var racine = document.getElementById("jeu");
  if (!racine) return;

  // --- Interface : construite par le script, dans l'emplacement prévu ---
  racine.innerHTML =
    '<p class="statut" id="statut" role="status"></p>' +
    '<p class="score" id="score"></p>' +
    '<ul class="plateau" id="plateau"></ul>' +
    '<p><button type="button" class="bouton" id="rejouer">Nouvelle partie</button></p>';

  var plateau = document.getElementById("plateau");
  var statut = document.getElementById("statut");
  var score = document.getElementById("score");

  // --- État du jeu ---
  var cartes = [];        // { symbole, nom, etat, bouton }, etat = cachee | visible | trouvee
  var premiere = null;    // index de la première carte retournée du coup en cours
  var erreur = null;      // les deux cartes d'un essai raté, encore visibles
  var coups = 0;
  var trouvees = 0;

  // Mélange de Fisher-Yates : tirage équitable de l'ordre des cartes
  function melanger(tableau) {
    for (var i = tableau.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = tableau[i]; tableau[i] = tableau[j]; tableau[j] = temp;
    }
    return tableau;
  }

  // Texte lu par le lecteur d'écran quand le focus arrive sur une carte
  function libelle(i) {
    var c = cartes[i];
    var ligne = Math.floor(i / COLONNES) + 1;
    var colonne = (i % COLONNES) + 1;
    var base = "Carte " + (i + 1) + ", ligne " + ligne + ", colonne " + colonne + " : ";
    if (c.etat === "cachee") return base + "face cachée";
    return base + c.nom + (c.etat === "trouvee" ? ", paire trouvée" : "");
  }

  // Met à jour l'apparence d'une carte selon son état
  function afficher(i) {
    var c = cartes[i], b = c.bouton;
    b.setAttribute("data-etat", c.etat);
    b.setAttribute("aria-label", libelle(i));
    b.setAttribute("aria-disabled", c.etat === "trouvee" ? "true" : "false");
    if (c.etat === "cachee") {
      b.innerHTML = '<span class="symbole" aria-hidden="true">?</span>';
    } else {
      b.innerHTML =
        '<span class="symbole" aria-hidden="true">' + c.symbole + '</span>' +
        '<span class="nom" aria-hidden="true">' + c.nom + '</span>' +
        (c.etat === "trouvee" ? '<span class="note" aria-hidden="true">✓ trouvée</span>' : "");
    }
  }

  // Message vocal et visuel (zone role="status", annoncée par les lecteurs d'écran)
  function annoncer(texte) { statut.textContent = texte; }

  function majScore() {
    score.textContent = "Coups : " + coups + " · Paires : " + trouvees + " sur " + ELEMENTS.length;
  }

  function cacher(i) { cartes[i].etat = "cachee"; afficher(i); }

  // --- Logique d'un choix de carte ---
  function choisir(i) {
    var carte = cartes[i];
    if (carte.etat !== "cachee") return;

    // Si un essai raté est encore à l'écran, on cache ses deux cartes d'abord
    if (erreur) { cacher(erreur[0]); cacher(erreur[1]); erreur = null; }

    carte.etat = "visible";
    afficher(i);
    var nomCarte = "Carte " + (i + 1) + " : " + carte.nom + ". ";

    if (premiere === null) {          // première carte du coup
      premiere = i;
      annoncer(nomCarte + "Choisis une deuxième carte.");
      return;
    }

    // deuxième carte : on compare
    var j = premiere;
    var autre = cartes[j];
    premiere = null;
    coups++;

    if (autre.nom === carte.nom) {
      autre.etat = "trouvee"; carte.etat = "trouvee";
      afficher(j); afficher(i);
      trouvees++;
      majScore();
      if (trouvees === ELEMENTS.length) {
        annoncer("Bravo ! Toutes les paires sont trouvées en " + coups + " coups. Tu peux lancer une nouvelle partie.");
      } else {
        annoncer(nomCarte + "Paire trouvée ! " + trouvees + " sur " + ELEMENTS.length + ".");
      }
    } else {
      erreur = [j, i];
      majScore();
      annoncer(nomCarte + "Pas de paire avec " + autre.nom + ". Les deux cartes se cacheront à ton prochain choix.");
    }
  }

  // --- Nouvelle partie ---
  function demarrer() {
    plateau.innerHTML = "";
    premiere = null; erreur = null; coups = 0; trouvees = 0;

    var jeu = [];
    ELEMENTS.forEach(function (e) { jeu.push(e, e); });   // chaque élément en double
    melanger(jeu);

    cartes = jeu.map(function (e, i) {
      var li = document.createElement("li");
      var bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "carte";
      bouton.addEventListener("click", function () { choisir(i); });
      li.appendChild(bouton);
      plateau.appendChild(li);
      return { symbole: e[0], nom: e[1], etat: "cachee", bouton: bouton };
    });

    cartes.forEach(function (_, i) { afficher(i); });
    majScore();
    annoncer("Nouvelle partie. " + cartes.length + " cartes, " + ELEMENTS.length + " paires à trouver.");
  }

  document.getElementById("rejouer").addEventListener("click", demarrer);
  demarrer();
})();
