import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { GroupsModule } from './modules/groups/groups.module';
import { MembersModule } from './modules/members/members.module';
import { AclModule } from './modules/acl/acl.module';
import { ConnectorsModule } from './modules/connectors/connectors.module';
import { SkillsModule } from './modules/skills/skills.module';
import { ExpertsModule } from './modules/experts/experts.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { ModelsModule } from './modules/models/models.module';
import { DefaultAgentModule } from './modules/default-agent/default-agent.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { RuntimeModule } from './modules/runtime/runtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env'],
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    TenantsModule,
    GroupsModule,
    MembersModule,
    AclModule,
    ConnectorsModule,
    SkillsModule,
    ExpertsModule,
    KnowledgeModule,
    ModelsModule,
    DefaultAgentModule,
    SessionsModule,
    AttachmentsModule,
    RuntimeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
