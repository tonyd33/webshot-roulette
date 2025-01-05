
<h1 align="center">
  Webshot Roulette
  <br>
</h1>

<h4 align="center">A fanmade web game based on <a href="https://store.steampowered.com/app/2835570/Buckshot_Roulette/" target="_blank">Buckshot Roulette</a>.</h4>

<p align="center">
  <a href="https://github.com/tonyd33/webshot-roulette/actions/workflows/build.yml">
    <img src="https://github.com/tonyd33/webshot-roulette/actions/workflows/build.yml/badge.svg"
         alt="Build badge">
  </a>
</p>

<p align="center">
  <a href="#installation">Installation</a>
</p>

## Installation

### Docker

```sh
git clone https://github.com/tonyd33/webshot-roulette.git
cd webshot-roulette
docker compose up -d
```

This will start the client on http://localhost:9422 and the server on http://localhost:6707.

### Development

```sh
git clone https://github.com/tonyd33/webshot-roulette.git
cd webshot-roulette

# Install dependencies
cd shared && npm i && cd -
cd server && npm i && cd -
cd client && npm i && cd -

# In separate terminal windows,
docker run --rm --name redis -p 6379:6379 redis
cd server && PORT=6707 REDIS_HOST=localhost REDIS_PORT=6379 npm run start:dev
cd client && PORT=9422 SERVER_URL=http://localhost:6707 npx next start
```
