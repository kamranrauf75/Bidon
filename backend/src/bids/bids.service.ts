import { AuctionStatus } from '@prisma/client';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { CreateBidDto } from './dto/create-bid.dto';

interface LockedAuctionRow {
  id: number;
  startingPrice: string;
  endsAt: Date;
  status: AuctionStatus;
}

@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async placeBid(dto: CreateBidDto) {
    const userExists = await this.usersService.ensureUserExists(dto.userId);
    if (!userExists) {
      throw new BadRequestException('Invalid userId. User does not exist.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const lockedAuctionRows = await tx.$queryRaw<LockedAuctionRow[]>`
        SELECT id, "startingPrice", "endsAt", status
        FROM "AuctionItem"
        WHERE id = ${dto.itemId}
        FOR UPDATE
      `;

      const lockedAuction = lockedAuctionRows[0];

      if (!lockedAuction) {
        throw new NotFoundException('Auction not found');
      }

      const now = new Date();
      const isExpired =
        lockedAuction.status === AuctionStatus.ENDED ||
        now >= new Date(lockedAuction.endsAt);

      if (isExpired) {
        await tx.auctionItem.update({
          where: { id: dto.itemId },
          data: { status: AuctionStatus.ENDED },
        });
        throw new BadRequestException('Auction has already ended.');
      }

      const highestBid = await tx.bid.findFirst({
        where: { auctionItemId: dto.itemId },
        orderBy: [{ amount: 'desc' }, { createdAt: 'desc' }],
      });

      const minimumAllowedAmount = highestBid
        ? Number(highestBid.amount)
        : Number(lockedAuction.startingPrice);

      if (dto.amount <= minimumAllowedAmount) {
        throw new BadRequestException(
          `Bid amount must be greater than current highest bid (${minimumAllowedAmount}).`,
        );
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
}
