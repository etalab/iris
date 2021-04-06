# @etalab/iris

Chaîne de traitement et API de géocodage inverse pour associer un IRIS à un triplet `latitude`, `longitude` et `codeCommune`.

## Installation

```bash
yarn
```

## Préparation des données

Cette brique s'appuie actuellement sur les données **IRIS GE** produites par l'IGN.

### Téléchargement des données

La première étape est de télécharger les archives au format `7z` ou `7z.000` sur [l'espace dédié du site de l'IGN](https://geoservices.ign.fr/documentation/diffusion/telechargement-donnees-libres.html). Ces fichiers doivent être placés dans le dossier `/data`.

### Construction de la base de données

```bash
yarn build
```

Le fichier résultat `dist/iris.json` fait environ 500 Mo (non compressé).

## Lancement de l'API

L'API nécessite 4 Go de mémoire vive disponible.

```bash
yarn start
```

Par défaut l'API écoute sur le port `5000`. Vous pouvez changer de port en utilisant la variable d'environnement `PORT`

## Documentation de l'API

GET `/iris?lon={longitude}&lat={latitude}&codeCommune={codeCommune}`

| Paramètre | Description |
| --- | --- |
| `lat` | Latitude du point (WGS-84) |
| `lon` | Longitude du point (WGS-84) |
| `codeCommune` | Code (INSEE) de la commune considérée |

Exemple : http://localhost:5000/iris?lon=6.14144&lat=49.14875&codeCommune=57415

Exemple de retour :

```json
{
  "nomCommune":"Lorry-lès-Metz",
  "codeCommune":"57415",
  "iris":"0000",
  "codeIris":"574150000",
  "nomIris":"Lorry-lès-Metz",
  "typeIris":"Z"
}
```

### Erreurs

En cas de requête mal formée, l'API retourne une erreur `400`.
Si aucun IRIS n'est trouvé, l'API retourne une erreur `404`.

## Licence

Le code est placé sous licence [MIT](LICENCE.md).
