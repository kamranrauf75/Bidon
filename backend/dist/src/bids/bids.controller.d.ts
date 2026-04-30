import { BidsService } from './bids.service';
import { CreateBidDto } from './dto/create-bid.dto';
export declare class BidsController {
    private readonly bidsService;
    constructor(bidsService: BidsService);
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
