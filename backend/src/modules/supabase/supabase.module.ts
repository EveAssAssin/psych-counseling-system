import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  providers: [
    {
      provide: SupabaseService,
      useFactory: (configService: ConfigService) => {
        return new SupabaseService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [SupabaseService],
})
export class SupabaseModule {}
