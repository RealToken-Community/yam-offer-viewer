# RealToken Offer Viewer

Mini-projet pour visualiser et acheter des offres RealToken YAM par ID.

## 🚀 Démarrage rapide

### Prérequis

- Node.js >= 18.12.0
- npm >= 8.0.0 ou yarn

### Installation

1. **Cloner ou créer le projet**

```bash
mkdir realtoken-offer-viewer
cd realtoken-offer-viewer
```

2. **Installer les dépendances**

```bash
npm install
# ou
yarn install
```

3. **Configurer les variables d'environnement**

Créer un fichier `.env.local` à la racine du projet :

```env
# API Community RealT (backend)
COMMUNITY_API_KEY=votre_clé_api

# API Community RealT (public)
NEXT_PUBLIC_COMMUNITY_API_URI=https://api.realt.community/v1

# API YAM (public)
NEXT_PUBLIC_API_URL=https://yam-api.realt.community

# Environnement
NEXT_PUBLIC_ENV=dev
```

Pour obtenir une `COMMUNITY_API_KEY`, rejoindre le [canal Telegram dev](https://t.me/+XQyoaFfmN61yk7X0)

4. **Lancer le serveur de développement**

```bash
npm run dev
# ou
yarn dev
```

5. **Ouvrir dans le navigateur**

```
http://localhost:3000/view-offer?id=VOTRE_ID
```

## 📁 Structure du projet

```
realtoken-offer-viewer/
├── pages/
│   ├── _app.tsx           # Application Next.js
│   ├── _document.tsx      # Document HTML personnalisé
│   └── view-offer.tsx     # Page principale
├── styles/
│   └── globals.css        # Styles globaux
├── public/                # Assets statiques
├── .env.local             # Variables d'environnement (à créer)
├── .env.example           # Template des variables
├── next.config.js         # Configuration Next.js
├── tsconfig.json          # Configuration TypeScript
├── tailwind.config.js     # Configuration Tailwind CSS
├── postcss.config.js      # Configuration PostCSS
├── package.json           # Dépendances du projet
└── README.md             # Ce fichier
```

## 🔧 Scripts disponibles

```bash
# Développement
npm run dev

# Build de production
npm run build

# Démarrer en production
npm run start

# Vérifier le code
npm run lint

# Vérifier les types TypeScript
npm run type-check
```

## 🌐 Utilisation

### Rechercher une offre

1. Entrer un ID d'offre dans la barre de recherche
2. Cliquer sur "Rechercher" ou appuyer sur Entrée
3. Les détails de l'offre s'affichent

### Lien direct

Partager un lien direct vers une offre :

```
https://votre-domaine.com/view-offer?id=123
```

### Acheter une offre

1. Cliquer sur "Acheter cette offre"
2. Entrer la quantité souhaitée
3. Confirmer la transaction

## 📡 APIs utilisées

### RealToken Community API

- **Endpoint**: `https://api.realt.community/v1`
- **Documentation**: [API Community](https://api.realt.community)
- **Authentification**: Header `X-AUTH-REALT-TOKEN`

### YAM API

- **Endpoint**: `https://yam-api.realt.community`
- **Documentation**: Disponible sur le repo [realtoken-yam-interface](https://github.com/real-token/realtoken-yam-interface)

## 🔐 Sécurité

⚠️ **Important** : 
- Ne jamais commit le fichier `.env.local`
- La `COMMUNITY_API_KEY` ne doit jamais être exposée côté client
- Seules les variables avec `NEXT_PUBLIC_` sont accessibles côté client

## 🚀 Déploiement

### Vercel (recommandé)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel
```

N'oubliez pas de configurer les variables d'environnement dans le dashboard Vercel.

### Docker

```bash
# Build
docker build -t realtoken-offer-viewer .

# Run
docker run -p 3000:3000 realtoken-offer-viewer
```

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📝 Licence

MIT - Voir le fichier `LICENSE` pour plus de détails.

## 🔗 Liens utiles

- [RealToken](https://realt.co/)
- [RealToken YAM Interface](https://github.com/real-token/realtoken-yam-interface)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs/)

## 💬 Support

- Telegram dev: [https://t.me/+XQyoaFfmN61yk7X0](https://t.me/+XQyoaFfmN61yk7X0)
- Issues GitHub: [Créer une issue](https://github.com/votre-repo/issues)