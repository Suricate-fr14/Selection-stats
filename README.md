# Selection Stats

Extension Chrome (Manifest V3) qui affiche `count`, `sum`, `avg`, `min`, `max` des nombres sélectionnés dans une page, et permet de copier des cellules de tableau au format TSV (collage direct dans Excel / Google Sheets).

## Fonctionnalités

- **Sélection de cellules dans les tableaux HTML**
  - glisser : plage rectangulaire
  - `Ctrl` / `Cmd` + clic ou glisser : ajouter une plage
  - `Ctrl` / `Cmd` + clic sur une cellule déjà sélectionnée : la retirer
  - `Shift` + clic : étendre la plage courante
  - `Échap` : tout effacer
- **Sélection de cellules : comme un tableur**, seules les cellules numériques comptent. Une cellule est numérique si elle contient un seul nombre, éventuellement accompagné d'un symbole monétaire, de `%` ou d'une unité courte (`12 kg`, `1 234,56 €`, `$ 2,500.00`). Les en-têtes (`th`), textes (`iPhone 15`), dates et heures sont ignorés.
- **Sélection de texte classique** hors tableau : les statistiques portent sur tous les nombres du texte sélectionné, hors dates et heures.
- **Copie** via le bouton `Copy` ou `Ctrl` / `Cmd` + `C` (au format TSV).
- La barre **suit le défilement** de la page et reste visible dans la fenêtre.

## Formats numériques reconnus

| Format | Exemple | Valeur |
|---|---|---|
| Point décimal, virgule de milliers | `1,234.56` | 1234,56 |
| Virgule décimale, point de milliers | `1.234,56` | 1234,56 |
| Espace insécable ou fine de milliers | `1 234 567` | 1234567 |
| Espace normale de milliers (avec décimales) | `1 234,56` | 1234,56 |
| Apostrophe de milliers (suisse) | `1'234.50` | 1234,5 |
| Négatifs : `-`, `−` typographique, parenthèses comptables | `-12`, `−12`, `(12)` | -12 |

Cas ambigus :
- `1,234` et `1.234` sont interprétés selon la langue déclarée par la page (`<html lang>`) : `1,234` vaut 1,234 sur une page en français et 1234 sur une page en anglais. Sans langue déclarée, les deux valent 1234.
- `10 200` avec une espace normale et sans décimales, dans un texte libre, donne deux nombres (10 et 200).
- Les chiffres collés à une lettre (`A4`, `v2`) ne sont pas comptés.
- **Activation / désactivation** : clic sur l'icône de l'extension (vert = actif, rouge = désactivé). L'état est mémorisé.
- Désactivée d'office sur Google Sheets / Docs / Slides, Airtable, Notion et Smartsheet, qui ont leur propre sélection.

## Installation

1. Ouvrir `chrome://extensions`.
2. Activer le **mode développeur**.
3. **Charger l'extension non empaquetée** et choisir le dossier du projet.

## Tests

- Automatiques (Node 18+) : `node --test tests/`
- Manuel : ouvrir `test.html` dans Chrome, extension activée. Pour un fichier local, autoriser « Accès aux URL de fichier » dans les détails de l'extension.

## Fichiers

| Fichier | Rôle |
|---|---|
| `manifest.json` | Déclaration de l'extension (permissions `storage`, `clipboardWrite`) |
| `background.js` | Icône générée dynamiquement, bascule actif / désactivé |
| `parse.js` | Extraction des nombres (texte et cellules) |
| `content.js` | Sélection, calcul des statistiques, barre d'affichage, copie |
| `test.html` | Page de test manuel |
| `tests/parse.test.js` | Tests automatiques de `parse.js` |

## Sécurité

- La barre de statistiques est placée dans un Shadow DOM fermé : la page ne peut ni la lire, ni la restyler, ni déclencher le bouton `Copy` par un clic simulé.
- Les messages reçus par le content script ne sont acceptés que s'ils proviennent de l'extension elle-même.
- Protection contre l'injection de formules : une cellule copiée commençant par `=`, `+`, `-` ou `@` (hors nombre) est préfixée d'une apostrophe pour ne pas être exécutée comme formule dans le tableur.
- `Ctrl` + `C` n'est pas intercepté lorsque le focus est dans un champ de saisie.
- Aucune donnée n'est envoyée hors du navigateur ; seul l'état actif / désactivé est stocké (`chrome.storage.local`).

## Changelog

### 1.5
- Cellules : seules les cellules numériques sont comptées ; en-têtes, textes, dates et heures ignorés.
- Nombres : prise en charge des milliers séparés par espace ou apostrophe, du signe `−`, des négatifs entre parenthèses ; dates et heures ignorées ; `1,234` / `1.234` interprétés selon la langue de la page.
- La barre suit le défilement et le redimensionnement de la fenêtre.
- Extraction des nombres déplacée dans `parse.js`, avec tests automatiques.

### 1.4
- Sécurité : Shadow DOM fermé pour la barre, vérification de l'émetteur des messages, neutralisation des formules à la copie.
- Correctif : `Ctrl` + `C` n'est plus détourné dans les champs de saisie.
- Correctif : plus d'erreur sur les très grandes sélections.
- Correctif : l'échec de la copie de secours est signalé (« Copy failed »).
