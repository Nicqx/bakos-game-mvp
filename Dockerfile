FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
# Use npm ci when a lockfile exists; otherwise fall back to npm install.
# This keeps the image buildable from the MVP zip, which intentionally did not include package-lock.json.
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

COPY . .

ENV NODE_ENV=production
ENV PORT=8105

EXPOSE 8105

CMD ["node", "server.js"]
