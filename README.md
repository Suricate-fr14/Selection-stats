# Selection Stats

Extension Chrome (Manifest V3) qui affiche des statistiques (somme, moyenne, min, max…) sur les nombres sélectionnés dans une page, et copie des cellules de tableau au format TSV (collage direct dans Excel / Google Sheets).

## Fonctionnalités

### Sélection de cellules

Fonctionne sur les tableaux HTML, les grilles ARIA (`div` avec `role="grid"`, `"table"` ou `"treegrid"`) et les tableaux placés dans des iframes.

| Action | Effet |
|---|---|
| Glisser | Plage rectangulaire |
| `Ctrl` / `Cmd` + clic ou glisser | Ajouter une plage (la retirer si la cellule est déjà sélectionnée) |
| `Shift` + clic | Étendre la plage courante |
| `Alt` + clic | Colonne entière ; dans la 1re colonne (hors ligne d'en-tête) : ligne entière |
| `Ctrl` + `Alt` + clic | Ajouter la colonne / ligne (la retirer si elle est déjà entièrement sélectionnée) |
| `Ctrl` / `Cmd` + `C` ou bouton Copier | Copier la sélection (TSV) |
| `Échap` | Tout effacer |
| Molette pendant un glisser, ou glisser vers le bord de la fenêtre | La page défile et la sélection s'étend |

- `cellules` compte toutes les cellules non vides, texte compris.
- Les calculs portent sur les cellules numériques : un seul nombre, éventuellement accompagné d'un symbole monétaire, de `%` ou d'une unité courte (`12 kg`, `1 234,56 €`, `$ 2,500.00`). Une cellule `toto`, `iPhone 15` ou une date compte dans `cellules` mais pas dans la somme.
- La copie reprend le contenu de toutes les cellules sélectionnées, telles quelles.

### Sélection de texte

Hors tableau, les statistiques portent sur tous les nombres du texte sélectionné, hors dates et heures.

### Barre de statistiques

- Indicateurs disponibles : cellules, nombre de valeurs, somme, moyenne, min, max, médiane, écart-type (d'échantillon, comme `ÉCARTYPE` dans un tableur), valeurs distinctes.
- Nombres formatés selon la langue choisie (`1 234,56` en français, `1,234.56` en anglais) ; libellés en français ou en anglais.
- Une valeur non nulle trop petite pour le nombre de décimales choisi s'affiche avec 3 chiffres significatifs (`0,00123`) plutôt que `0`.
- La barre suit le défilement et reste visible dans la fenêtre.

### Activation et options

- Clic sur l'icône de l'extension : activer (vert) / désactiver (rouge). L'état est mémorisé.
- Clic droit sur l'icône → **Options** :
  - indicateurs affichés (par défaut : cellules, nombre, somme, moyenne, min, max) ;
  - nombre de décimales (0 à 6, défaut 2) ;
  - format des nombres (automatique selon la langue du navigateur, français, anglais, allemand, suisse) ;
  - sites exclus, un par ligne : `domaine` (sous-domaines inclus) ou `domaine/chemin`. Par défaut : Google Sheets / Docs / Slides, Airtable, Notion, Smartsheet, qui ont leur propre sélection.
- Les options sont synchronisées entre les navigateurs Chrome connectés au même compte (`chrome.storage.sync`).

## Formats numériques reconnus

| Format | Exemple | Valeur |
|---|---|---|
| Point décimal, virgule de milliers | `1,234.56` | 1234,56 |
| Virgule décimale, point de milliers | `1.234,56` | 1234,56 |
| Espace insécable ou fine de milliers | `1 234 567` | 1234567 |
| Espace normale de milliers (avec décimales, ou seule dans une cellule) | `1 234,56`, `105 000` | 1234,56, 105000 |
| Apostrophe de milliers (suisse) | `1'234.50` | 1234,5 |
| Négatifs : `-`, `−` typographique, parenthèses comptables | `-12`, `−12`, `(12)` | -12 |

Cas ambigus :
- `1,234` et `1.234` sont interprétés selon la langue déclarée par la page (`<html lang>`) : `1,234` vaut 1,234 sur une page en français et 1234 sur une page en anglais. Sans langue déclarée, les deux valent 1234.
- Dans un texte libre, `10 200` (espace normale, sans décimales) donne deux nombres : 10 et 200.
- Les chiffres collés à une lettre (`A4`, `v2`) ne sont pas comptés.

## Installation

1. Ouvrir `chrome://extensions`.
2. Activer le **mode développeur**.
3. **Charger l'extension non empaquetée** et choisir le dossier du projet.

Mise à jour : une extension non empaquetée ne se met pas à jour toute seule. Après `git pull`, cliquer sur « Recharger » dans `chrome://extensions`. La mise à jour automatique nécessite une publication sur le Chrome Web Store.

## Tests

- Automatiques (Node 18+) : `node --test`
- Manuel : ouvrir `test.html` dans Chrome, extension activée. Pour un fichier local, autoriser « Accès aux URL de fichier » dans les détails de l'extension.

## Fichiers

| Fichier | Rôle |
|---|---|
| `manifest.json` | Déclaration de l'extension (permissions `storage`, `clipboardWrite`) |
| `background.js` | Icône actif / désactivé, bascule au clic |
| `settings.js` | Réglages par défaut, validation, sites exclus |
| `parse.js` | Extraction des nombres (texte et cellules) |
| `stats.js` | Calcul et mise en forme des statistiques |
| `content.js` | Sélection, barre d'affichage, copie |
| `options.html`, `options.js` | Page d'options |
| `icons/` | Icônes (actif `on-*`, désactivé `off-*`) |
| `test.html` | Page de test manuel |
| `tests/` | Tests automatiques (`parse`, `stats`, `settings`) |

## Sécurité

- La barre de statistiques est placée dans un Shadow DOM fermé : la page ne peut ni la lire, ni la restyler, ni déclencher le bouton Copier par un clic simulé.
- Les messages reçus par le content script ne sont acceptés que s'ils proviennent de l'extension elle-même.
- Les réglages lus du stockage sont validés (types, bornes, langue) avant usage.
- Protection contre l'injection de formules : une cellule copiée commençant par `=`, `+`, `-` ou `@` (hors nombre) est préfixée d'une apostrophe pour ne pas être exécutée comme formule dans le tableur.
- `Ctrl` + `C` n'est pas intercepté lorsque le focus est dans un champ de saisie.
- Aucune donnée n'est envoyée hors du navigateur ; seuls l'état actif / désactivé (`chrome.storage.local`) et les options (`chrome.storage.sync`) sont stockés.

## Changelog

### 1.7
- Grilles ARIA (`div` avec `role="grid"`, `"table"`, `"treegrid"`) prises en charge.
- Tableaux dans les iframes pris en charge.
- `Alt` + clic : colonne entière (ligne entière dans la 1re colonne) ; `Ctrl` + `Alt` + clic pour l'ajouter ou la retirer.
- Résultats formatés selon la langue (`1 234,56` en français), libellés en français ou en anglais, nombre de décimales réglable ; les très petites valeurs ne s'affichent plus `0`.
- Nouveaux indicateurs optionnels : médiane, écart-type, valeurs distinctes.
- Page d'options : indicateurs, décimales, format, sites exclus.
- Icônes PNG fixes (actif / désactivé).
- Une cellule `105 000` (espace normale) est lue comme un seul nombre.

### 1.6
- La sélection de cellules s'étend pendant un défilement à la molette en cours de glisser.
- Défilement automatique de la page quand on glisse vers le bord haut ou bas de la fenêtre.

### 1.5
- Cellules : nouvel indicateur `cells` (cellules non vides, texte compris) ; la barre et le bouton Copy restent affichés même si la sélection ne contient aucun nombre. Les calculs portent sur les cellules numériques (textes, dates et heures exclus du calcul, pas de la copie).
- Nombres : prise en charge des milliers séparés par espace ou apostrophe, du signe `−`, des négatifs entre parenthèses ; dates et heures ignorées ; `1,234` / `1.234` interprétés selon la langue de la page.
- La barre suit le défilement et le redimensionnement de la fenêtre.
- Extraction des nombres déplacée dans `parse.js`, avec tests automatiques.

### 1.4
- Sécurité : Shadow DOM fermé pour la barre, vérification de l'émetteur des messages, neutralisation des formules à la copie.
- Correctif : `Ctrl` + `C` n'est plus détourné dans les champs de saisie.
- Correctif : plus d'erreur sur les très grandes sélections.
- Correctif : l'échec de la copie de secours est signalé (« Copy failed »).
