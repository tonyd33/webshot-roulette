FROM node:22.8.0-alpine3.19

RUN apk add --no-cache tini curl

WORKDIR /server

COPY shared ../shared
RUN cd ../shared && npm install

COPY server/package.json server/package-lock.json ./
RUN npm install

COPY server .

RUN npm run build

ENV PORT=9422
EXPOSE 9422/tcp

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node dist/server/src/main.js"]

