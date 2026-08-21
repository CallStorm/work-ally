import { Module } from '@nestjs/common';
import { DefaultAgentController } from './default-agent.controller';
import { DefaultAgentService } from './default-agent.service';

@Module({
  controllers: [DefaultAgentController],
  providers: [DefaultAgentService],
  exports: [DefaultAgentService],
})
export class DefaultAgentModule {}
