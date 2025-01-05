FROM node:22.8.0-alpine3.19

RUN apk add --no-cache tini curl

WORKDIR /client

COPY shared/package.json shared/package-lock.json ../shared/
RUN cd ../shared && npm install

COPY client/package.json client/package-lock.json ./
RUN npm install

COPY shared/src ../shared/src

COPY client/next.config.ts \
     client/tailwind.config.ts \
     client/tsconfig.json \
     client/postcss.config.mjs \
     ./
COPY client/pages ./pages
COPY client/lib ./lib
COPY client/public ./public
COPY client/components ./components
COPY client/hooks ./hooks
COPY client/app ./app

RUN npm run build

ENV PORT=6707
EXPOSE 6707/tcp

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm run start"]

