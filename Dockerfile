FROM node:20-slim

# git is required at runtime -- the server shells out to
# `git upload-pack` / `git receive-pack` to handle push/pull.
RUN apt-get update && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# Bare repositories live here. Attach a persistent volume at this path on
# whatever platform you deploy to, or pushed data will disappear on the
# next redeploy/restart. See README.md.
RUN mkdir -p /app/data/repos
VOLUME ["/app/data/repos"]

ENV PORT=4000
EXPOSE 4000
CMD ["node", "server.js"]
