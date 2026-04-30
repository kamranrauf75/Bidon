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
exports.AuctionsService = void 0;
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AuctionsService = class AuctionsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        const now = new Date();
        const endsAt = new Date(now.getTime() + dto.durationSeconds * 1000);
        const auction = await this.prisma.auctionItem.create({
            data: {
                name: dto.name,
                description: dto.description,
                durationSeconds: dto.durationSeconds,
                startingPrice: dto.startingPrice,
                endsAt,
            },
            include: {
                bids: {
                    orderBy: { amount: 'desc' },
                    take: 1,
                },
            },
        });
        return this.toAuctionResponse(auction);
    }
    async findAll() {
        await this.markExpiredAuctions();
        const auctions = await this.prisma.auctionItem.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                bids: {
                    orderBy: { amount: 'desc' },
                    take: 1,
                },
            },
        });
        return auctions.map((auction) => this.toAuctionResponse(auction));
    }
    async findOne(id) {
        await this.markExpiredAuctions();
        const auction = await this.prisma.auctionItem.findUnique({
            where: { id },
            include: {
                bids: {
                    orderBy: { amount: 'desc' },
                    take: 1,
                },
            },
        });
        if (!auction) {
            throw new common_1.NotFoundException('Auction not found');
        }
        return this.toAuctionResponse(auction);
    }
    toAuctionResponse(auction) {
        const highestBid = auction.bids[0];
        const now = Date.now();
        const endsAtMs = auction.endsAt.getTime();
        const remainingSeconds = Math.max(0, Math.ceil((endsAtMs - now) / 1000));
        return {
            id: auction.id,
            name: auction.name,
            description: auction.description,
            startingPrice: Number(auction.startingPrice),
            durationSeconds: auction.durationSeconds,
            createdAt: auction.createdAt,
            endsAt: auction.endsAt,
            status: auction.status === client_1.AuctionStatus.ENDED || remainingSeconds === 0
                ? client_1.AuctionStatus.ENDED
                : client_1.AuctionStatus.ACTIVE,
            currentHighestBid: highestBid
                ? {
                    amount: Number(highestBid.amount),
                    userId: highestBid.userId,
                    createdAt: highestBid.createdAt,
                }
                : null,
            remainingSeconds,
        };
    }
    async markExpiredAuctions() {
        await this.prisma.auctionItem.updateMany({
            where: {
                status: client_1.AuctionStatus.ACTIVE,
                endsAt: { lte: new Date() },
            },
            data: { status: client_1.AuctionStatus.ENDED },
        });
    }
};
exports.AuctionsService = AuctionsService;
exports.AuctionsService = AuctionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuctionsService);
//# sourceMappingURL=auctions.service.js.map