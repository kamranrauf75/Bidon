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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BidsService = void 0;
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
const users_service_1 = require("../users/users.service");
let BidsService = class BidsService {
    prisma;
    usersService;
    realtimeGateway;
    constructor(prisma, usersService, realtimeGateway) {
        this.prisma = prisma;
        this.usersService = usersService;
        this.realtimeGateway = realtimeGateway;
    }
    async placeBid(dto) {
        const userExists = await this.usersService.ensureUserExists(dto.userId);
        if (!userExists) {
            throw new common_1.BadRequestException('Invalid userId. User does not exist.');
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const lockedAuctionRows = await tx.$queryRaw `
        SELECT id, "startingPrice", "endsAt", status
        FROM "AuctionItem"
        WHERE id = ${dto.itemId}
        FOR UPDATE
      `;
            const lockedAuction = lockedAuctionRows[0];
            if (!lockedAuction) {
                throw new common_1.NotFoundException('Auction not found');
            }
            const now = new Date();
            const isExpired = lockedAuction.status === client_1.AuctionStatus.ENDED ||
                now >= new Date(lockedAuction.endsAt);
            if (isExpired) {
                await tx.auctionItem.update({
                    where: { id: dto.itemId },
                    data: { status: client_1.AuctionStatus.ENDED },
                });
                throw new common_1.BadRequestException('Auction has already ended.');
            }
            const highestBid = await tx.bid.findFirst({
                where: { auctionItemId: dto.itemId },
                orderBy: [{ amount: 'desc' }, { createdAt: 'desc' }],
            });
            const minimumAllowedAmount = highestBid
                ? Number(highestBid.amount)
                : Number(lockedAuction.startingPrice);
            if (dto.amount <= minimumAllowedAmount) {
                throw new common_1.BadRequestException(`Bid amount must be greater than current highest bid (${minimumAllowedAmount}).`);
            }
            const bid = await tx.bid.create({
                data: {
                    auctionItemId: dto.itemId,
                    userId: dto.userId,
                    amount: dto.amount,
                },
            });
            return {
                id: bid.id,
                itemId: bid.auctionItemId,
                userId: bid.userId,
                amount: Number(bid.amount),
                createdAt: bid.createdAt,
            };
        });
        this.realtimeGateway.emitBidUpdated({
            itemId: result.itemId,
            userId: result.userId,
            amount: result.amount,
            createdAt: result.createdAt,
        });
        return {
            message: 'Bid placed successfully.',
            bid: result,
        };
    }
};
exports.BidsService = BidsService;
exports.BidsService = BidsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        users_service_1.UsersService,
        realtime_gateway_1.RealtimeGateway])
], BidsService);
//# sourceMappingURL=bids.service.js.map