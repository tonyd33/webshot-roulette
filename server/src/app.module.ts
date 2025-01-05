import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game/game.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import redisConfig from './config/redis.config';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule.forRootAsync(redisConfig.asProvider()),
    // RedisModule.forRoot({
    // config: {
    // host: process.env.REDIS_HOST ?? 'localhost',
    // port: +(process.env.REDIS_PORT ?? '6379'),
    // },
    // }),
    GameModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
