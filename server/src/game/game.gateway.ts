import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import * as randomstring from 'randomstring';
import Result, { map } from 'src/common/monads/result';
import { parse, serialize } from 'cookie';
import { Lobby, PublicDelta } from './game.types';
import { GameService } from './game.service';
import * as R from 'ramda';

enum ClientEvent {
  create = 'create',
  chat = 'chat',
  act = 'act',
  join = 'join',
  start = 'start',
  poll = 'poll',
  whoami = 'whoami',
}

enum ServerEvent {
  delta = 'delta',
  sync = 'sync',
  chat = 'chat',
  error = 'error',
  whoyouare = 'whoyouare',
}

const SOCKETIO_COOKIE = 'ioid';

const getClientId = (client: Socket) => {
  const parsed = parse(client.handshake.headers.cookie ?? '')[SOCKETIO_COOKIE];
  return parsed ? Result.ok(parsed) : Result.err('Who are you?');
};

const handleCookie = (headers, request) => {
  if (!request.headers.cookie) return;

  const cookies = parse(request.headers.cookie);
  if (!cookies[SOCKETIO_COOKIE]) {
    headers['Set-Cookie'] = serialize(
      SOCKETIO_COOKIE,
      randomstring.generate(32),
      {
        maxAge: 86400,
        sameSite: 'lax',
        secure: false,
      },
    );
  }
};

const withResult = <X, E>(
  succMsg: (x: any) => unknown,
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
const withDeltaResult = withResult<PublicDelta, string>;
const withWhoyouareResult = withResult<string, string>;

@WebSocketGateway({ cookie: true })
export class GameGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gameService: GameService) {}

  afterInit() {
    this.server.engine.on('initial_headers', handleCookie);
    this.server.engine.on('headers', handleCookie);
  }

  @SubscribeMessage(ClientEvent.create)
  async handleCreateLobby(@ConnectedSocket() client: Socket) {
    withSyncResult(
      (payload) => client.emit(ServerEvent.sync, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      await getClientId(client)
        .map((clientId) => this.gameService.createLobby(clientId))
        .unwrapOrElse((e: string) => Promise.resolve(Result.err(e))),
    );
  }

  @SubscribeMessage(ClientEvent.whoami)
  async handleWhoami(@ConnectedSocket() client: Socket) {
    console.log('Responding to whoami');
    withWhoyouareResult(
      (payload) => client.emit(ServerEvent.whoyouare, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      getClientId(client),
    );
  }

  @SubscribeMessage(ClientEvent.join)
  async handleJoinLobby(
    @MessageBody() lobbyId: string,
    @ConnectedSocket() client: Socket,
  ) {
    withSyncResult(
      (payload) => this.server.to(lobbyId).emit(ServerEvent.sync, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      await getClientId(client)
        .map((clientId) => this.gameService.joinLobby(lobbyId, clientId))
        .unwrapOrElse((e: string) => Promise.resolve(Result.err(e)))
        .then(map(R.tap((lobby: Lobby) => client.join(lobby.id)))),
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
    console.log(`Starting game ${lobbyId}`);

    withDeltaResult(
      (payload) => this.server.to(lobbyId).emit(ServerEvent.delta, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      await getClientId(client)
        .map(() => this.gameService.start(lobbyId))
        .unwrapOrElse((e: string) => Promise.resolve(Result.err(e))),
    );
  }

  @SubscribeMessage(ClientEvent.act)
  async handleMakeMove(
    @MessageBody() { lobbyId, action }: { lobbyId: string; action: any },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`Making move on lobby ${lobbyId}`, action);
    withDeltaResult(
      (payload) => this.server.to(lobbyId).emit(ServerEvent.delta, payload),
      (payload) => client.emit(ServerEvent.error, payload),
      await getClientId(client)
        .map((clientId) =>
          this.gameService.updateGame(lobbyId, clientId, action),
        )
        .unwrapOrElse((e: string) => Promise.resolve(Result.err(e))),
    );
  }
}
