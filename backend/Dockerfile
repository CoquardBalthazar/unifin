FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "./src/index.ts"]
