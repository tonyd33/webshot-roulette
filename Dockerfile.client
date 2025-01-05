FROM node:22.8.0-alpine3.19

RUN apk add --no-cache tini curl

WORKDIR /client

COPY shared ../shared
RUN cd ../shared && npm install

COPY client/package.json client/package-lock.json ./
RUN npm install

COPY client .

RUN npm run build

ENV PORT=6707
EXPOSE 6707/tcp

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm run start"]

