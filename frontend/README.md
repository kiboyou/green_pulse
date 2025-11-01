# Frontend — Green Pulse

Interface utilisateur Next.js pour le projet Green Pulse. Le frontend consomme l'API d'inférence (FastAPI) et affiche les prévisions, visualisations temporelles et tableaux de bord.

## Technologies

- Framework : Next.js
- Langage : TypeScript
- Styles : CSS Modules / Tailwind (selon les composants)
- Gestion des dépendances : npm / pnpm

## Structure (extrait)

```
frontend/
├── public/
├── src/
│   ├── app/
│   ├── components/
│   └── types/
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Variables d'environnement

Le frontend attend au minimum :

- `NEXT_PUBLIC_API_URL` : URL publique (ou locale) de l'API (ex: `http://localhost:8000`)

Créez un fichier `.env.local` pour le développement :

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Installation & développement

1. Se positionner dans le dossier `frontend/` :

```bash
cd frontend
```

2. Installer les dépendances :

```bash
npm install
```

3. Lancer le serveur de développement :

```bash
npm run dev
# puis ouvrir http://localhost:3000
```

## Build & Production

Générer la build :

```bash
npm run build
npm start
```

Docker (optionnel) : construire l'image et lancer :

```bash
docker build -t greenpulse-frontend .
docker run -e NEXT_PUBLIC_API_URL="https://api.example.com" -p 3000:3000 greenpulse-frontend
```

## Tests & qualité

- Ajouter des tests unitaires pour les composants React
- Lancer les linters/formatters présents dans `package.json` (si configurés)

## Déploiement

Le frontend peut être déployé sur Vercel, Netlify ou via une image Docker. Veillez à configurer `NEXT_PUBLIC_API_URL` selon l'environnement (dev/staging/prod).

## Contribution

1. Créez une branche feature
2. Ajoutez les tests correspondants
3. Ouvrez une Pull Request

---
Voir le README principal pour la vision MLOps et le planning (racine du dépôt).
