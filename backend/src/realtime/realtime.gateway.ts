import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    this.logger.debug(`Socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('auction.subscribe')
  handleAuctionSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { itemId?: number },
  ): void {
    if (!body?.itemId) return;
    client.join(this.getRoom(body.itemId));
  }

  emitBidUpdated(payload: {
    itemId: number;
    amount: number;
    userId: number;
    createdAt: Date;
  }): void {
    this.server.to(this.getRoom(payload.itemId)).emit('bid.updated', payload);
    this.server.emit('bid.updated', payload);
  }

  private getRoom(itemId: number): string {
    return `auction:${itemId}`;
  }
}
