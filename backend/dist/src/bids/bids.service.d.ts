import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { CreateBidDto } from './dto/create-bid.dto';
export declare class BidsService {
    private readonly prisma;
    private readonly usersService;
    private readonly realtimeGateway;
    constructor(prisma: PrismaService, usersService: UsersService, realtimeGateway: RealtimeGateway);
    placeBid(dto: CreateBidDto): Promise<{
        message: string;
        bid: {
            id: number;
            itemId: number;
            userId: number;
            amount: number;
            createdAt: Date;
        };
    }>;
}
