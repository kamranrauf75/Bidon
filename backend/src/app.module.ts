import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuctionsModule } from './auctions/auctions.module';
import { BidsModule } from './bids/bids.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    RealtimeModule,
    AuctionsModule,
    BidsModule,
  ],
})
export class AppModule {}
