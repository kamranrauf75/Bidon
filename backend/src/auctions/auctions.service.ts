import { AuctionStatus, type AuctionItem, type Bid } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuctionDto } from './dto/create-auction.dto';

type AuctionWithBid = AuctionItem & { bids: Bid[] };

@Injectable()
export class AuctionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAuctionDto) {
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

  async findOne(id: number) {
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
      throw new NotFoundException('Auction not found');
    }

    return this.toAuctionResponse(auction);
  }

  private toAuctionResponse(auction: AuctionWithBid) {
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
      status:
        auction.status === AuctionStatus.ENDED || remainingSeconds === 0
          ? AuctionStatus.ENDED
          : AuctionStatus.ACTIVE,
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

  async markExpiredAuctions(): Promise<void> {
    await this.prisma.auctionItem.updateMany({
      where: {
        status: AuctionStatus.ACTIVE,
        endsAt: { lte: new Date() },
      },
      data: { status: AuctionStatus.ENDED },
    });
  }
}
