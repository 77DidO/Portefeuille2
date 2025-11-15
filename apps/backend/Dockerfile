# Backend Dockerfile
FROM node:20-alpine

# Installation des dépendances système pour Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copier tous les fichiers nécessaires
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/backend ./apps/backend

# Installer toutes les dépendances (dev inclus pour le build)
RUN npm install --workspace backend --workspace @portefeuille/types

# Build du package types
RUN npm run build --workspace @portefeuille/types

# Générer le client Prisma
WORKDIR /app/apps/backend
RUN npx prisma generate

# Build du backend
RUN npm run build

# Nettoyer les dépendances de dev
WORKDIR /app
RUN npm prune --workspace backend --omit=dev

# Créer le dossier pour la base de données
WORKDIR /app/apps/backend
RUN mkdir -p prisma

EXPOSE 4000

# Commande de démarrage avec migration de la base de données
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
