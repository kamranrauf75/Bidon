import { PrismaService } from '../prisma/prisma.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
export declare class AuctionsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateAuctionDto): Promise<{
        id: number;
        name: string;
        description: string;
        startingPrice: number;
        durationSeconds: number;
        createdAt: Date;
        endsAt: Date;
        status: "ACTIVE" | "ENDED";
        currentHighestBid: {
            amount: number;
            userId: number;
            createdAt: Date;
        } | null;
        remainingSeconds: number;
    }>;
    findAll(): Promise<{
        id: number;
        name: string;
        description: string;
        startingPrice: number;
        durationSeconds: number;
        createdAt: Date;
        endsAt: Date;
        status: "ACTIVE" | "ENDED";
        currentHighestBid: {
            amount: number;
            userId: number;
            createdAt: Date;
        } | null;
        remainingSeconds: number;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        name: string;
        description: string;
        startingPrice: number;
        durationSeconds: number;
        createdAt: Date;
        endsAt: Date;
        status: "ACTIVE" | "ENDED";
        currentHighestBid: {
            amount: number;
            userId: number;
            createdAt: Date;
        } | null;
        remainingSeconds: number;
    }>;
    private toAuctionResponse;
    markExpiredAuctions(): Promise<void>;
}
