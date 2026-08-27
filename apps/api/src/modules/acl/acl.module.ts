import { Module } from '@nestjs/common';
import { AclController } from './acl.controller';
import { AclService } from './acl.service';

@Module({
  controllers: [AclController],
  providers: [AclService],
  exports: [AclService],
})
export class AclModule {}
