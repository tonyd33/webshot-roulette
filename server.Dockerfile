FROM node:22.8.0-alpine3.19

RUN apk add --no-cache tini curl

WORKDIR /server

# Yeah this path mapping is a bit awkward, but fortunately the relative path
# never escapes the rootfs so a 1-1 relative mapping still works lol
COPY shared/package.json shared/package-lock.json ../shared/
RUN cd ../shared && npm install

COPY server/package.json server/package-lock.json ./
RUN npm install

COPY shared/src ../shared/src

COPY server/nest-cli.json server/tsconfig.json ./
COPY server/src ./src

RUN npm run build

ENV PORT=9422
EXPOSE 9422/tcp

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node dist/server/src/main.js"]

