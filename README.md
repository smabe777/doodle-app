# Doodle App - Planning EPEBW Musique

Une application de sondage pour planifier des sessions de musique avec disponibilités et sélection d'instruments.

## Fonctionnalités

- ✅ Interface entièrement en français
- ✅ Création de sondages avec dates hebdomadaires
- ✅ Sélection de participants et instruments
- ✅ Choix de disponibilité : Oui / Si nécessaire / Non
- ✅ Sélection d'instruments par date
- ✅ Pré-sélection des instruments favoris
- ✅ Chargement automatique des réponses précédentes
- ✅ Stockage MongoDB pour la persistance des données

## Installation

### Prérequis

- Node.js 18+ installé
- MongoDB installé localement OU compte MongoDB Atlas (gratuit)

### 1. Installer les dépendances

```bash
cd /Users/rod777/projects/doodle-app
npm install
```

### 2. Configuration de la base de données

#### Option A : MongoDB Local (développement)

Installez MongoDB localement :
```bash
# macOS (avec Homebrew)
brew install mongodb-community
brew services start mongodb-community

# La connexion par défaut sera : mongodb://localhost:27017/doodle-app
```

#### Option B : MongoDB Atlas (production/cloud)

1. Créez un compte gratuit sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Créez un cluster (niveau gratuit disponible)
3. Créez un utilisateur de base de données
4. Autorisez votre adresse IP (ou 0.0.0.0/0 pour tout autoriser)
5. Obtenez votre URI de connexion

### 3. Variables d'environnement (optionnel)

Créez un fichier `.env` (copie de `.env.example`) :

```bash
cp .env.example .env
```

Modifiez `.env` avec votre configuration :
```env
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/doodle-app?retryWrites=true&w=majority
```

**Note :** Si vous n'avez pas de fichier `.env`, l'app utilisera MongoDB local par défaut.

### 4. Démarrer l'application

```bash
npm start
```

L'application sera disponible sur `http://localhost:3000`

## Déploiement

### Render (Recommandé)

1. Créez un compte sur [Render](https://render.com)
2. Créez un nouveau "Web Service"
3. Connectez votre repository GitHub
4. Configuration :
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**: Ajoutez `MONGODB_URI` avec votre URI MongoDB Atlas
5. Déployez !

### Railway

1. Créez un compte sur [Railway](https://railway.app)
2. Créez un nouveau projet depuis GitHub
3. Ajoutez un plugin MongoDB (gratuit)
4. Railway configurera automatiquement `MONGODB_URI`
5. Déployez !

### Fly.io

```bash
# Installer flyctl
brew install flyctl

# Se connecter
fly auth login

# Lancer l'app
fly launch

# Ajouter MongoDB (ou utiliser MongoDB Atlas)
fly secrets set MONGODB_URI="your-mongodb-uri"

# Déployer
fly deploy
```

## Structure du projet

```
doodle-app/
├── server.js          # Serveur HTTP et API
├── db.js             # Connexion MongoDB
├── package.json      # Dépendances
├── .env.example      # Exemple de configuration
├── public/           # Fichiers statiques
│   ├── index.html    # Page de création de sondage
│   ├── poll.html     # Page de réponse au sondage
│   ├── app.js        # JavaScript client
│   └── style.css     # Styles CSS
└── data/             # Ancien dossier de données (n'est plus utilisé)
```

## Migration depuis le stockage fichier

Si vous avez des données existantes dans `data/polls/`, vous pouvez les migrer vers MongoDB :

```bash
# Créez un script de migration
node migrate-to-mongodb.js
```

(Script de migration disponible sur demande)

## Développement

Pour le développement local avec rechargement automatique :

```bash
# Installer nodemon globalement
npm install -g nodemon

# Démarrer avec nodemon
nodemon server.js
```

## Support

Pour toute question ou problème, créez une issue sur le repository GitHub.
