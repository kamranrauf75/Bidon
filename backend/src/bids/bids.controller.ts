import { Body, Controller, Post } from '@nestjs/common';
import { BidsService } from './bids.service';
import { CreateBidDto } from './dto/create-bid.dto';

@Controller('bids')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Post()
  placeBid(@Body() dto: CreateBidDto) {
    return this.bidsService.placeBid(dto);
  }
}
