import { Module } from '@nestjs/common';
import { OfficialChannelController } from './official-channel.controller';
import { OfficialChannelService } from './official-channel.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [OfficialChannelController],
  providers: [OfficialChannelService],
  exports: [OfficialChannelService],
})
export class OfficialChannelModule {}
