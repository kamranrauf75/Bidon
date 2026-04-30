"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var RealtimeGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
let RealtimeGateway = RealtimeGateway_1 = class RealtimeGateway {
    logger = new common_1.Logger(RealtimeGateway_1.name);
    server;
    handleConnection(client) {
        this.logger.debug(`Socket connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.debug(`Socket disconnected: ${client.id}`);
    }
    handleAuctionSubscribe(client, body) {
        if (!body?.itemId)
            return;
        client.join(this.getRoom(body.itemId));
    }
    emitBidUpdated(payload) {
        this.server.to(this.getRoom(payload.itemId)).emit('bid.updated', payload);
        this.server.emit('bid.updated', payload);
    }
    getRoom(itemId) {
        return `auction:${itemId}`;
    }
};
exports.RealtimeGateway = RealtimeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", Function)
], RealtimeGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('auction.subscribe'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function, Object]),
    __metadata("design:returntype", void 0)
], RealtimeGateway.prototype, "handleAuctionSubscribe", null);
exports.RealtimeGateway = RealtimeGateway = RealtimeGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
    })
], RealtimeGateway);
//# sourceMappingURL=realtime.gateway.js.map