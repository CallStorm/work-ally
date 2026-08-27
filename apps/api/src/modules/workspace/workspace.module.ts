import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { ArtifactService } from './artifact.service';
import { ArtifactPromotionListener } from './artifact-promotion.listener';
import { RuntimeModule } from '../runtime/runtime.module';

@Module({
  imports: [RuntimeModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, ArtifactService, ArtifactPromotionListener],
  exports: [WorkspaceService, ArtifactService],
})
export class WorkspaceModule {}
