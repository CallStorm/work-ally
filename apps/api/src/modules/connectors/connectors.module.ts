import { Module, forwardRef } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { AclModule } from '../acl/acl.module';
import { RuntimeModule } from '../runtime/runtime.module';

@Module({
  imports: [AclModule, forwardRef(() => RuntimeModule)],
  controllers: [ConnectorsController],
  providers: [ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
