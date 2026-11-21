FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV PORT=7860
EXPOSE 7860
CMD ["node", "src/server.js"]
