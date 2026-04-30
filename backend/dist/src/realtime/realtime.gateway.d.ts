import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
export declare class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger;
    server: Server;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleAuctionSubscribe(client: Socket, body: {
        itemId?: number;
    }): void;
    emitBidUpdated(payload: {
        itemId: number;
        amount: number;
        userId: number;
        createdAt: Date;
    }): void;
    private getRoom;
}
