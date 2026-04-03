FROM uhub.service.ucloud.cn/syyy/node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY server.ts tsconfig.json ./

VOLUME ["/app/data", "/app/content"]

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data
ENV CONTENT_PATH=/app/content

EXPOSE 3001

CMD ["npx", "tsx", "server.ts"]
