# Frontend Dockerfile - Version simplifiée qui utilise les node_modules locaux
FROM node:20-alpine

WORKDIR /app

# Copier les fichiers de configuration
COPY package.json ./
COPY tsconfig.base.json ./

# Copier les packages (types avec le build)
COPY packages ./packages

# Copier les node_modules déjà installés localement (beaucoup plus rapide)
COPY node_modules ./node_modules

# Copier le frontend
COPY apps/frontend ./apps/frontend

WORKDIR /app/apps/frontend

# Build du frontend avec la variable d'environnement
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
