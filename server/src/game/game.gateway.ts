import {
  ConnectedSocket,
  GatewayMetadata,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import * as randomstring from 'randomstring';
import Result, { map, tryOr } from '@shared/true-myth/result';
import { parse, serialize } from 'cookie';
import { GameService } from './game.service';
import * as R from 'ramda';
import {
  ClientEvent,
  Lobby,
  PublicGameDelta,
  ServerEvent,
} from '@shared/game/types';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';

const SOCKETIO_COOKIE = 'ioid';
const salt = 'foo bar baz qux';

const getClientId = (client: Socket): Result<string, string> => {
  const parsed = parse(
    client.handshake.headers.cookie ?? client.request.headers.cookie ?? '',
  )[SOCKETIO_COOKIE];
  return parsed ? Result.ok(parsed) : Result.err('Who are you?');
};

const getPlayerId = (client: Socket): Result<string, string> => {
  return getClientId(client).map((clientId) =>
    uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: '-',
      seed: clientId + salt,
    }),
  );
};

const handleCookie = (headers, request) => {
  const cookie = tryOr('No cookies', () =>
    parse(request.headers.cookie),
  ).andThen((cookies) =>
    cookies[SOCKETIO_COOKIE] ? Result.ok() : Result.err('No cookie'),
  );

  if (cookie.isErr) {
    const clientId = randomstring.generate(32);
    const cookieStr = serialize(SOCKETIO_COOKIE, clientId, {
      maxAge: 86400,
      sameSite: 'lax',
      secure: false,
    });
    headers['Set-Cookie'] = cookieStr;
    // temporary measure to make sure we can later fetch the cookie in
    // getClientId
    // TODO: don't do this lol
    headers.cookie = `${headers.cookie}; ${cookieStr}`;
    request.headers.cookie = `${request.headers.cookie}; ${cookieStr}`;
  }
};

const withResult = <X, E>(
  succMsg: (x: X) => unknown,
  errMsg: (x: any) => unknown,
  result: Result<X, E>,
) => {
  if (result.isErr) {
    errMsg(result.error);
  } else {
    succMsg(result.value);
  }
};

const withSyncResult = withResult<Lobby, string>;
const withDeltaResult = withResult<PublicGameDelta[], string>;
const withWhoyouareResult = withResult<string, string>;
const withStartResult = withResult<
  { lobby: Lobby; deltas: PublicGameDelta[] },
  string
>;

@WebSocketGateway<GatewayMetadata>({
  // defaults
  transports: ['polling', 'websocket'],

  path: '/v1/ws',
  // it seems like without this, the handleCookie call doesn't happen?
  // TODO: Debug this
  cookie: true,
})
export class GameGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gameService: GameService) {}

  afterInit() {
    this.server.engine.on('initial_headers', handleCookie);
    // this.server.engine.on('headers', handleCookie);
  }

  @SubscribeMessage(ClientEvent.create)
  async handleCreateLobby(@ConnectedSocket() client: Socket) {
    withSyncResult(
      (payload) => client.emit(ServerEvent.syncLobby, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      await getPlayerId(client)
        .map(
          R.tap((clientId) =>
            console.log(`Creating new lobby for ${clientId}`),
          ),
        )
        .map((clientId) => this.gameService.createLobby(clientId))
        .unwrapOrElse((e: string) => Promise.resolve(Result.err(e))),
    );
  }

  @SubscribeMessage(ClientEvent.changeActivity)
  async handleChangeActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { lobbyId, to }: { lobbyId: string; to: 'spectate' | 'active' },
  ) {
    withSyncResult(
      (payload) => this.server.to(lobbyId).emit(ServerEvent.syncLobby, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      await getPlayerId(client)
        .map(
          R.tap((clientId) =>
            console.log(
              `Changing activity for client ${clientId} on lobby ${lobbyId} to ${to}`,
            ),
          ),
        )
        .map((clientId) =>
          this.gameService.changeActivity(lobbyId, clientId, to),
        )
        .unwrapOrElse((e: string) => Promise.resolve(Result.err(e))),
    );
  }

  @SubscribeMessage('connect')
  async handleConnect(@ConnectedSocket() client: Socket) {
    withResult(
      () => {},
      () => {},
      getPlayerId(client).map(
        R.tap((clientId) => console.log(`${clientId} connected`)),
      ),
    );
  }

  @SubscribeMessage(ClientEvent.disconnect)
  async handleDisconnect(@ConnectedSocket() client: Socket) {
    withResult(
      () => {},
      () => {},
      getPlayerId(client).map(
        R.tap((clientId) => console.log(`${clientId} disconnected`)),
      ),
    );
  }

  @SubscribeMessage(ClientEvent.poll)
  async handlePoll(
    @ConnectedSocket() client: Socket,
    @MessageBody() lobbyId: string,
  ) {
    withSyncResult(
      (payload) => client.emit(ServerEvent.syncLobby, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      await getPlayerId(client)
        .map(
          R.tap((clientId) =>
            console.log(`Responding to poll for ${clientId} on ${lobbyId}`),
          ),
        )
        .map(() => this.gameService.getLobby(lobbyId))
        .unwrapOrElse((e: string) => Promise.resolve(Result.err(e))),
    );
  }

  @SubscribeMessage(ClientEvent.whoami)
  async handleWhoami(@ConnectedSocket() client: Socket) {
    withWhoyouareResult(
      (payload) => client.emit(ServerEvent.whoyouare, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      getPlayerId(client).map(
        R.tap((clientId) => console.log(`${clientId} requested whoami`)),
      ),
    );
  }

  @SubscribeMessage(ClientEvent.join)
  async handleJoinLobby(
    @MessageBody() lobbyId: string,
    @ConnectedSocket() client: Socket,
  ) {
    withSyncResult(
      (payload) => this.server.to(lobbyId).emit(ServerEvent.syncLobby, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      await getPlayerId(client)
        .map(
          R.tap((clientId) =>
            console.log(`${clientId} joining lobby ${lobbyId}`),
          ),
        )
        .map((clientId) => this.gameService.joinLobby(lobbyId, clientId))
        .unwrapOrElse((e: string) => Promise.resolve(Result.err(e)))
        .then(map(R.tap(() => client.join(lobbyId)))),
    );
  }

  @SubscribeMessage(ClientEvent.chat)
  async handleChat(
    @MessageBody() { msg, lobbyId }: { lobbyId: string; msg: string },
  ) {
    console.log(`Received chat in ${lobbyId}`, msg);
    this.server.to(lobbyId).emit('chat', msg);
  }

  @SubscribeMessage(ClientEvent.start)
  async handleStart(
    @MessageBody() { lobbyId }: { lobbyId: string },
    @ConnectedSocket() client: Socket,
  ) {
    withStartResult(
      (payload) => this.server.to(lobbyId).emit(ServerEvent.start, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      await getPlayerId(client)
        .map(
          R.tap((clientId) =>
            console.log(`Client ${clientId} started on lobby ${lobbyId}`),
          ),
        )
        .map((clientId) => this.gameService.start(lobbyId, clientId))
        .unwrapOrElse((e: string) => Promise.resolve(Result.err(e))),
    );
  }

  @SubscribeMessage(ClientEvent.act)
  async handleMakeMove(
    @MessageBody() { lobbyId, action }: { lobbyId: string; action: any },
    @ConnectedSocket() client: Socket,
  ) {
    withDeltaResult(
      (payload) => this.server.to(lobbyId).emit(ServerEvent.delta, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      await getPlayerId(client)
        .map(
          R.tap((clientId) =>
            console.log(`Client ${clientId} made a move on lobby ${lobbyId}`),
          ),
        )
        .map((clientId) =>
          this.gameService.updateGame(lobbyId, clientId, action),
        )
        .unwrapOrElse((e: string) => Promise.resolve(Result.err(e))),
    );
  }
}
