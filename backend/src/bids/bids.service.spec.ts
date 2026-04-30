import { AuctionStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { BidsService } from './bids.service';

describe('BidsService', () => {
  const usersService = {
    ensureUserExists: jest.fn(),
  };

  const realtimeGateway = {
    emitBidUpdated: jest.fn(),
  };

  const makeService = (transactionImpl: (callback: (tx: any) => Promise<any>) => Promise<any>) => {
    const prisma = {
      $transaction: jest.fn(transactionImpl),
    };

    return new BidsService(prisma as any, usersService as any, realtimeGateway as any);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.ensureUserExists.mockResolvedValue(true);
  });

  it('rejects bid amount lower or equal to current highest bid', async () => {
    const service = makeService(async (callback) =>
      callback({
        $queryRaw: jest.fn().mockResolvedValue([
          {
            id: 1,
            startingPrice: '10',
            endsAt: new Date(Date.now() + 60_000),
            status: AuctionStatus.ACTIVE,
          },
        ]),
        bid: {
          findFirst: jest.fn().mockResolvedValue({
            id: 10,
            amount: '100',
            createdAt: new Date(),
          }),
          create: jest.fn(),
        },
        auctionItem: { update: jest.fn() },
      }),
    );

    await expect(service.placeBid({ itemId: 1, userId: 1, amount: 100 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects bid when auction has expired', async () => {
    const service = makeService(async (callback) =>
      callback({
        $queryRaw: jest.fn().mockResolvedValue([
          {
            id: 1,
            startingPrice: '10',
            endsAt: new Date(Date.now() - 1000),
            status: AuctionStatus.ACTIVE,
          },
        ]),
        bid: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        auctionItem: { update: jest.fn().mockResolvedValue(undefined) },
      }),
    );

    await expect(service.placeBid({ itemId: 1, userId: 1, amount: 20 })).rejects.toThrow(
      'Auction has already ended.',
    );
  });

  it('accepts the highest bid and emits real-time event', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 1,
          startingPrice: '10',
          endsAt: new Date(Date.now() + 60_000),
          status: AuctionStatus.ACTIVE,
        },
      ]),
      bid: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1,
          amount: '100',
          createdAt: new Date(),
        }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 2,
            auctionItemId: data.auctionItemId,
            userId: data.userId,
            amount: data.amount,
            createdAt: new Date(),
          }),
        ),
      },
      auctionItem: { update: jest.fn() },
    };

    const service = makeService(async (callback) => callback(tx));

    const result = await service.placeBid({ itemId: 1, userId: 2, amount: 101 });

    expect(result.bid.amount).toBe(101);
    expect(realtimeGateway.emitBidUpdated).toHaveBeenCalledTimes(1);
  });

  it('handles simultaneous bids by accepting only the valid highest progression', async () => {
    let currentHighest = 100;
    let locked = false;

    const runLocked = async <T>(fn: () => Promise<T>): Promise<T> => {
      while (locked) {
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      locked = true;
      try {
        return await fn();
      } finally {
        locked = false;
      }
    };

    const service = makeService(async (callback) =>
      runLocked(async () =>
        callback({
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: 1,
              startingPrice: '10',
              endsAt: new Date(Date.now() + 60_000),
              status: AuctionStatus.ACTIVE,
            },
          ]),
          bid: {
            findFirst: jest.fn().mockResolvedValue({
              amount: String(currentHighest),
              createdAt: new Date(),
            }),
            create: jest.fn().mockImplementation(({ data }) => {
              currentHighest = Number(data.amount);
              return Promise.resolve({
                id: 99,
                auctionItemId: data.auctionItemId,
                userId: data.userId,
                amount: data.amount,
                createdAt: new Date(),
              });
            }),
          },
          auctionItem: { update: jest.fn() },
        }),
      ),
    );

    const [first, second] = await Promise.allSettled([
      service.placeBid({ itemId: 1, userId: 1, amount: 101 }),
      service.placeBid({ itemId: 1, userId: 2, amount: 101 }),
    ]);

    const fulfilled = [first, second].filter((r) => r.status === 'fulfilled');
    const rejected = [first, second].filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});
