FROM node:18
WORKDIR /app
COPY package.json ./
RUN npm install --silent --no-audit --no-fund --legacy-peer-deps
COPY . .
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
