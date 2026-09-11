# 图工作室（Image Studio）MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工作台新增内置 App「图工作室」（slug `image-studio`）：管理员配置租户级图像模型；普通用户按项目做文生图/图生图，数据按 `(tenantId, userId)` 隔离。

**Architecture:** 与闪签/笔记同模式——`AppRegistry` soft-seed、`ImageStudioAppGuard`、Nest `/apps/image-studio`、Prisma + MinIO。UI 参考 Layerive 项目库 + 工作台交互，深集成进 Next workbench（不跑独立 Layerive 进程）。图像模型独立表，不复用聊天 `LlmProvider`/`ModelConfig`。

**Tech Stack:** NestJS, Prisma/MySQL, MinIO (`ObjectStorageService`), Next.js App Router, `@work-ally/shared` Zod, `encryptSecret`/`decryptSecret`, fetch 调 OpenAI-compatible Images API

**Spec:** `docs/superpowers/specs/2026-09-11-image-studio-design.md`

## Global Constraints

- 显示名「图工作室」；slug `image-studio`；用户路由 `/workbench/apps/image-studio`；管理 `/admin/apps/image-studio`；API `/apps/image-studio` 与 `/admin/apps/image-studio`
- 数据隔离：`tenantId + userId`；无跨用户共享
- MVP：项目库 + 文生图/图生图 + 回合历史 + 最多 4 候选；不做局部改图/扩图/Vision/提示词画廊/导入导出
- Provider MVP：仅实现 `openai_compatible`；`gemini` 等只允许枚举占位，调用时返回明确「暂不支持」
- 用户模型列表不得返回 `apiKey` / `apiKeyEnc` / 解密后的密钥
- 本仓库无 Jest/Vitest；每任务用 `pnpm --filter @work-ally/api lint` / `pnpm --filter @work-ally/web lint` + 手验
- 样式跟工作台 token；类名前缀 `.image-studio-`
- 移植 Layerive 交互时保留 LGPL/来源声明（`apps/web/src/components/image-studio/NOTICE`）

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/index.ts` | `IMAGE_STUDIO_SLUG` + Zod schemas |
| `apps/api/prisma/schema.prisma` | `ImageStudioModel` / `Project` / `Turn` / `Asset` + Tenant 关系 |
| `apps/api/prisma/migrations/<ts>_image_studio/migration.sql` | CREATE 表 |
| `apps/api/src/modules/apps/app-registry.service.ts` | `ensureImageStudio`、list seed、`getImageStudioForUser`、`updateImageStudio` |
| `apps/api/src/modules/apps/image-studio-app.guard.ts` | 启用 + ACL |
| `apps/api/src/modules/apps/admin-apps.controller.ts` | get/patch 支持 `image-studio` |
| `apps/api/src/modules/auth/auth.service.ts` | 新租户 seed image-studio |
| `apps/api/src/modules/apps/image-studio/image-studio-models.service.ts` | 租户模型 CRUD / test / default |
| `apps/api/src/modules/apps/image-studio/image-studio-projects.service.ts` | 项目 CRUD |
| `apps/api/src/modules/apps/image-studio/image-studio-assets.service.ts` | 上传、选中、内容流 |
| `apps/api/src/modules/apps/image-studio/image-studio-generate.service.ts` | Turn 生命周期 + 调 provider |
| `apps/api/src/modules/apps/image-studio/providers/openai-compatible-images.ts` | Images API adapter |
| `apps/api/src/modules/apps/image-studio/image-studio.controller.ts` | 用户 HTTP |
| `apps/api/src/modules/apps/image-studio/admin-image-studio.controller.ts` | 管理 HTTP（models + registry 亦可挂这里） |
| `apps/api/src/modules/apps/apps.module.ts` | 注册 providers |
| `apps/web/src/components/image-studio/*` | 项目库 + 工作台 UI |
| `apps/web/src/app/workbench/apps/image-studio/page.tsx` | 用户入口 |
| `apps/web/src/app/admin/apps/image-studio/page.tsx` | 管理入口 |
| `apps/web/src/app/workbench/apps/page.tsx` | 应用卡片 |
| `apps/web/src/app/admin/layout.tsx` | 导航链 |
| `apps/web/src/app/globals.css` | `.image-studio-*` |
| `docs/dev-setup.md` | 一句图工作室说明（可选短注） |

---

### Task 1: Shared Zod — Image Studio schemas

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `IMAGE_STUDIO_SLUG`, `CreateImageStudioProjectSchema`, `UpdateImageStudioProjectSchema`, `GenerateImageStudioSchema`, `CreateImageStudioModelSchema`, `UpdateImageStudioModelSchema` 及对应 `*Input` types

- [ ] **Step 1: Append after NOTES schemas**

```ts
export const IMAGE_STUDIO_SLUG = 'image-studio';

export const ImageStudioProviderSchema = z.enum([
  'openai_compatible',
  'gemini',
]);
export type ImageStudioProvider = z.infer<typeof ImageStudioProviderSchema>;

export const CreateImageStudioProjectSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(2000).optional().default(''),
  defaultModelId: z.string().cuid().nullable().optional(),
});
export type CreateImageStudioProjectInput = z.infer<
  typeof CreateImageStudioProjectSchema
>;

export const UpdateImageStudioProjectSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  description: z.string().trim().max(2000).optional(),
  starred: z.boolean().optional(),
  defaultModelId: z.string().cuid().nullable().optional(),
  currentAssetId: z.string().cuid().nullable().optional(),
  workspaceState: z.record(z.unknown()).nullable().optional(),
});
export type UpdateImageStudioProjectInput = z.infer<
  typeof UpdateImageStudioProjectSchema
>;

export const GenerateImageStudioSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  modelId: z.string().cuid().optional(),
  sourceAssetId: z.string().cuid().nullable().optional(),
  n: z.number().int().min(1).max(4).optional().default(1),
  parentTurnId: z.string().cuid().nullable().optional(),
});
export type GenerateImageStudioInput = z.infer<typeof GenerateImageStudioSchema>;

export const CreateImageStudioModelSchema = z.object({
  name: z.string().trim().min(1).max(128),
  provider: ImageStudioProviderSchema.default('openai_compatible'),
  baseUrl: z.string().url().max(512),
  apiKey: z.string().trim().min(1).max(2048),
  modelName: z.string().trim().min(1).max(191),
  capabilities: z
    .object({
      textToImage: z.boolean().default(true),
      imageToImage: z.boolean().default(true),
    })
    .default({ textToImage: true, imageToImage: true }),
  defaultParams: z.record(z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
});
export type CreateImageStudioModelInput = z.infer<
  typeof CreateImageStudioModelSchema
>;

export const UpdateImageStudioModelSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  provider: ImageStudioProviderSchema.optional(),
  baseUrl: z.string().url().max(512).optional(),
  apiKey: z.string().trim().min(1).max(2048).optional(),
  modelName: z.string().trim().min(1).max(191).optional(),
  capabilities: z
    .object({
      textToImage: z.boolean(),
      imageToImage: z.boolean(),
    })
    .optional(),
  defaultParams: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateImageStudioModelInput = z.infer<
  typeof UpdateImageStudioModelSchema
>;
```

- [ ] **Step 2: Build shared**

Run: `pnpm --filter @work-ally/shared build`  
Expected: 成功。

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add image-studio schemas and slug"
```

---

### Task 2: Prisma — Image Studio tables

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_image_studio/migration.sql`（用 `pnpm db:migrate` 生成）

**Interfaces:**
- Produces: Prisma models `ImageStudioModel`, `ImageStudioProject`, `ImageStudioTurn`, `ImageStudioAsset`

- [ ] **Step 1: Extend Tenant + add models**

在 `Tenant` 上增加：

```prisma
  imageStudioModels   ImageStudioModel[]
  imageStudioProjects ImageStudioProject[]
```

在 `User` 上增加（若有其它 app 关系旁）：

```prisma
  imageStudioProjects ImageStudioProject[]
```

文件末尾追加：

```prisma
model ImageStudioModel {
  id             String   @id @default(cuid())
  tenantId       String   @map("tenant_id")
  name           String
  provider       String   @default("openai_compatible")
  baseUrl        String   @map("base_url") @db.VarChar(512)
  apiKeyEnc      String   @map("api_key_enc") @db.Text
  modelName      String   @map("model_name") @db.VarChar(191)
  capabilities   Json
  defaultParams  Json     @default("{}") @map("default_params")
  enabled        Boolean  @default(true)
  isDefault      Boolean  @default(false) @map("is_default")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  tenant   Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  projects ImageStudioProject[]
  turns    ImageStudioTurn[]

  @@index([tenantId, enabled])
  @@map("image_studio_models")
}

model ImageStudioProject {
  id              String    @id @default(cuid())
  tenantId        String    @map("tenant_id")
  userId          String    @map("user_id")
  name            String    @db.VarChar(128)
  description     String    @default("") @db.VarChar(2000)
  coverObjectKey  String?   @map("cover_object_key") @db.VarChar(512)
  currentAssetId  String?   @map("current_asset_id")
  defaultModelId  String?   @map("default_model_id")
  starred         Boolean   @default(false)
  deletedAt       DateTime? @map("deleted_at")
  workspaceState  Json?     @map("workspace_state")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  tenant       Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  defaultModel ImageStudioModel?  @relation(fields: [defaultModelId], references: [id], onDelete: SetNull)
  turns        ImageStudioTurn[]
  assets       ImageStudioAsset[]

  @@index([tenantId, userId, deletedAt])
  @@index([tenantId, userId, updatedAt])
  @@map("image_studio_projects")
}

model ImageStudioTurn {
  id            String   @id @default(cuid())
  projectId     String   @map("project_id")
  parentTurnId  String?  @map("parent_turn_id")
  prompt        String   @db.Text
  modelId       String   @map("model_id")
  sourceAssetId String?  @map("source_asset_id")
  status        String   @default("pending") // pending|running|done|failed
  errorMessage  String?  @map("error_message") @db.Text
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  project ImageStudioProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  model   ImageStudioModel   @relation(fields: [modelId], references: [id])
  parent  ImageStudioTurn?   @relation("TurnTree", fields: [parentTurnId], references: [id], onDelete: SetNull)
  children ImageStudioTurn[] @relation("TurnTree")
  assets  ImageStudioAsset[]

  @@index([projectId, createdAt])
  @@map("image_studio_turns")
}

model ImageStudioAsset {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  turnId    String?  @map("turn_id")
  objectKey String   @map("object_key") @db.VarChar(512)
  width     Int?
  height    Int?
  mimeType  String   @default("image/png") @map("mime_type") @db.VarChar(128)
  selected  Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")

  project ImageStudioProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  turn    ImageStudioTurn?   @relation(fields: [turnId], references: [id], onDelete: SetNull)

  @@index([projectId, createdAt])
  @@index([turnId])
  @@map("image_studio_assets")
}
```

注意：`ImageStudioProject.currentAssetId` **不要**做 Prisma 外键到 `ImageStudioAsset`（避免循环依赖）；在 service 层校验归属。

- [ ] **Step 2: Migrate**

Run: `pnpm db:generate` 然后 `pnpm db:migrate`（migration 名 `image_studio`）  
Expected: client 生成成功，表已创建。

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add image-studio prisma models"
```

---

### Task 3: AppRegistry soft-seed + Guard + Admin registry patch

**Files:**
- Modify: `apps/api/src/modules/apps/app-registry.service.ts`
- Create: `apps/api/src/modules/apps/image-studio-app.guard.ts`
- Modify: `apps/api/src/modules/apps/admin-apps.controller.ts`
- Modify: `apps/api/src/modules/apps/apps.controller.ts`（若 list 需显式 ensure）
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/apps/apps.module.ts`（先注册 Guard）

**Interfaces:**
- Produces: `IMAGE_STUDIO_DEFAULT`, `ensureImageStudio`, `getImageStudioForUser`, `updateImageStudio`
- Consumes: `IMAGE_STUDIO_SLUG`

- [ ] **Step 1: Registry helpers**

对齐 `ensureNotes`：

```ts
export const IMAGE_STUDIO_DEFAULT = {
  slug: IMAGE_STUDIO_SLUG,
  name: '图工作室',
  description: '个人图像创作：项目、文生图/图生图与版本回合',
};
```

实现 `ensureImageStudio`、在 `listForUser`/`listForAdmin` 开头调用 ensure、复制 `getNotesForUser`→`getImageStudioForUser`、`updateNotes`→`updateImageStudio`。

- [ ] **Step 2: Guard**

```ts
@Injectable()
export class ImageStudioAppGuard implements CanActivate {
  constructor(private readonly registry: AppRegistryService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) return false;
    const app = await this.registry.getImageStudioForUser(user);
    if (!app) throw new ForbiddenException('无权使用图工作室');
    return true;
  }
}
```

- [ ] **Step 3: Admin patch allowlist**

`admin-apps.controller.ts`：`get` 时对 `IMAGE_STUDIO_SLUG` ensure；`patch` 允许 `image-studio` 并调用 `updateImageStudio`。

- [ ] **Step 4: Auth seed**

`auth.service.ts` 新租户创建 stickies/notes 处同步 `create` image-studio registry 行（或调用 `ensureImageStudio`）。

- [ ] **Step 5: Lint + commit**

Run: `pnpm --filter @work-ally/api lint`  
Expected: 通过。

```bash
git add apps/api/src/modules/apps apps/api/src/modules/auth/auth.service.ts
git commit -m "feat(api): register image-studio app and guard"
```

---

### Task 4: Admin image models CRUD + test + default

**Files:**
- Create: `apps/api/src/modules/apps/image-studio/image-studio-models.service.ts`
- Create: `apps/api/src/modules/apps/image-studio/admin-image-studio.controller.ts`
- Modify: `apps/api/src/modules/apps/apps.module.ts`

**Interfaces:**
- Produces:
  - `listForAdmin(tenantId)`
  - `create(tenantId, input: CreateImageStudioModelInput)`
  - `update(tenantId, id, input: UpdateImageStudioModelInput)`
  - `remove(tenantId, id)`
  - `setDefault(tenantId, id)`
  - `test(tenantId, id): Promise<{ ok: boolean; message: string }>`
  - `serializeAdmin(row)` / `serializePublic(row)`（public 无 key/baseUrl 敏感；MVP public 返回 `id,name,provider,modelName,capabilities,isDefault,enabled`——用户接口不返回 `baseUrl`）

- [ ] **Step 1: Service**

- 创建时 `apiKeyEnc = encryptSecret(apiKey, CREDENTIALS_ENCRYPTION_KEY)`
- `isDefault: true` 时先 `updateMany({ tenantId, isDefault: true }, { isDefault: false })`
- update 时 `apiKey` 缺省则保留原 `apiKeyEnc`
- `test`：decrypt key，对 `openai_compatible` `POST ${baseUrl}/images/generations`（或规范化去掉尾斜杠后拼路径）用极小请求；失败返回 `{ ok:false, message }` 不抛 500（业务 200 + ok 字段，或 400 + message——选 **400 BadRequest 带 message** 与现有 models test 风格对齐；若现有 admin models test 返回 JSON ok，则跟随 `models.service` 的 test 模式）

先读 `apps/api/src/modules/models/models.service.ts` 的 test 方法并复用相同响应形状。

- [ ] **Step 2: Controller**

```ts
@Controller('admin/apps/image-studio')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminImageStudioController {
  // GET/POST /models
  // PATCH/DELETE /models/:id
  // POST /models/:id/test
  // POST /models/:id/default
}
```

Registry 的 GET/PATCH 仍走现有 `AdminAppsController` 的 `:slug`（Task 3 已支持）。

- [ ] **Step 3: Lint + 手验**

Run API，用管理员 token：

```bash
# 创建模型（示例）
curl -s -X POST http://localhost:3001/api/admin/apps/image-studio/models \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"demo","baseUrl":"https://api.openai.com/v1","apiKey":"sk-...","modelName":"dall-e-3"}'
```

Expected: 返回无明文 key 的对象；`GET .../models` 列表可见。

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/apps/image-studio apps/api/src/modules/apps/apps.module.ts
git commit -m "feat(api): admin image-studio model management"
```

---

### Task 5: User projects + public models list

**Files:**
- Create: `apps/api/src/modules/apps/image-studio/image-studio-projects.service.ts`
- Create: `apps/api/src/modules/apps/image-studio/image-studio.controller.ts`
- Modify: `apps/api/src/modules/apps/apps.module.ts`

**Interfaces:**
- Produces: `list/create/get/update/softDelete`；`listPublicModels(tenantId)`
- Controller `@Controller('apps/image-studio')` + `@UseGuards(JwtAuthGuard, ImageStudioAppGuard)`

- [ ] **Step 1: Projects service**

```ts
async list(user: AuthUser) {
  return this.prisma.imageStudioProject.findMany({
    where: { tenantId: user.tenantId, userId: user.userId, deletedAt: null },
    orderBy: [{ starred: 'desc' }, { updatedAt: 'desc' }],
  });
}

async findOwned(user: AuthUser, id: string) {
  const p = await this.prisma.imageStudioProject.findFirst({
    where: { id, tenantId: user.tenantId, userId: user.userId, deletedAt: null },
  });
  if (!p) throw new NotFoundException('项目不存在');
  return p;
}
```

create/update/softDelete（`deletedAt = new Date()`）按 Zod input。

- [ ] **Step 2: Controller routes**

- `GET/POST projects`
- `GET/PATCH/DELETE projects/:id`
- `GET models` → `serializePublic` + `enabled: true` only

- [ ] **Step 3: 隔离手验**

用用户 A 创建项目，用户 B `GET projects/:id` → 404。

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/apps/image-studio
git commit -m "feat(api): image-studio projects and public models"
```

---

### Task 6: Upload, select, asset content stream

**Files:**
- Create: `apps/api/src/modules/apps/image-studio/image-studio-assets.service.ts`
- Modify: `apps/api/src/modules/apps/image-studio/image-studio.controller.ts`

**Interfaces:**
- Produces: `upload(user, projectId, file)`, `select(user, projectId, assetId)`, `getContent(user, assetId): { buffer, mimeType }`
- Storage key: `image-studio/${tenantId}/${userId}/${projectId}/${cuid}.png`（按实际 mime 后缀）

- [ ] **Step 1: Upload**

使用 Nest `FileInterceptor`；限制 mime `image/png|jpeg|webp`，大小 ≤ 10MB。  
创建 `ImageStudioAsset`：`turnId: null`，`projectId` 已校验归属。

- [ ] **Step 2: Select**

校验 asset 属于项目；将该项目其它 asset `selected=false`（可选）；设 `project.currentAssetId`；若无 cover 则 `coverObjectKey = asset.objectKey`。

- [ ] **Step 3: Content**

`GET assets/:id/content`：校验 asset→project 归属后 `objectStorage.getObject`，`Content-Type` 原样返回。  
前端 `<img src="/api/apps/image-studio/assets/${id}/content">` 需带 cookie/token——若浏览器 img 无法带 Authorization，则改为：

**选定方案：** `GET` 返回 JSON `{ url }` 不可行（无私有签名工具）。改用前端 `apiFetch` blob → `URL.createObjectURL`，或内容接口支持 `?access_token=`（对齐现有 SSE `access_token` 模式）。

实现：content 路由接受 `Authorization` **或** `query.access_token`（校验同 JWT）。前端 img 使用 `...?access_token=${token}`。

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/apps/image-studio
git commit -m "feat(api): image-studio upload select and asset content"
```

---

### Task 7: Generate pipeline + OpenAI-compatible adapter

**Files:**
- Create: `apps/api/src/modules/apps/image-studio/providers/openai-compatible-images.ts`
- Create: `apps/api/src/modules/apps/image-studio/image-studio-generate.service.ts`
- Modify: `image-studio.controller.ts`, `apps.module.ts`

**Interfaces:**
- Produces:
  - `generate(user, projectId, input: GenerateImageStudioInput): Promise<Turn>`
  - `getTurn(user, turnId)`
  - adapter `generateImages({ baseUrl, apiKey, modelName, prompt, n, sourceImage?: Buffer, defaultParams }): Promise<Array<{ buffer: Buffer; mimeType: string }>>`

- [ ] **Step 1: Adapter**

```ts
export async function openaiCompatibleImages(opts: {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  prompt: string;
  n: number;
  sourceImage?: Buffer;
  sourceMime?: string;
  defaultParams?: Record<string, unknown>;
}): Promise<Array<{ buffer: Buffer; mimeType: string }>> {
  const root = opts.baseUrl.replace(/\/$/, '');
  if (!opts.sourceImage) {
    const res = await fetch(`${root}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.modelName,
        prompt: opts.prompt,
        n: opts.n,
        response_format: 'b64_json',
        ...(opts.defaultParams ?? {}),
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as {
      data: Array<{ b64_json?: string; url?: string }>;
    };
    // decode b64 or fetch url → buffers
    ...
  }
  // image-to-image: multipart /images/edits with image + prompt
  ...
}
```

非 `openai_compatible`：抛 `BadRequestException('该 provider 暂未实现')`。

- [ ] **Step 2: Generate service**

1. `findOwned` project  
2. 解析 model：`input.modelId` ?? `project.defaultModelId` ?? 租户 `isDefault` enabled 模型；否则 `BadRequestException('请先由管理员配置默认图像模型')`  
3. 若 `sourceAssetId`：校验属于项目并 `getObject`  
4. 创建 turn `status: 'running'`  
5. try adapter → 每张图 `putObject` → create assets；`status: 'done'`；若项目无 current，选第一张并更新 cover/current  
6. catch → `status: 'failed'`, `errorMessage`（截断 2000 字）；仍返回 turn（HTTP 201），由前端轮询看 failed  

同步执行即可（请求内完成）；若超时风险大，可 `setImmediate` 异步——**MVP 选请求内同步**，网关超时则前端显示失败。

- [ ] **Step 3: Routes**

- `POST projects/:id/generate` → turn  
- `GET turns/:id` → turn + assets（经 project 归属）  
- `GET projects/:id/turns` → 列表含 assets  

- [ ] **Step 4: 手验**

配置真实或 mock 网关后 generate → turn done → assets content 可打开。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/apps/image-studio
git commit -m "feat(api): image-studio generate and openai-compatible provider"
```

---

### Task 8: Web — Admin 图工作室页 + 导航 + 应用卡片

**Files:**
- Create: `apps/web/src/app/admin/apps/image-studio/page.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`
- Modify: `apps/web/src/app/workbench/apps/page.tsx`
- Modify: `apps/web/src/app/globals.css`（卡片用色可先加）

**Interfaces:**
- Consumes: admin models API + `PATCH /admin/apps/image-studio`

- [ ] **Step 1: Admin page**

参考 `admin/apps/notes/page.tsx`：启用开关 + 模型列表表单（name、provider select、baseUrl、apiKey、modelName、capabilities checkboxes、启用、设默认、测试）。

- [ ] **Step 2: Nav + catalog**

`admin/layout.tsx` 增加「应用 · 图工作室」。  
`workbench/apps/page.tsx` 为 `image-studio` 增加卡片文案/图标分支，链接 `/workbench/apps/image-studio`。

- [ ] **Step 3: Lint + commit**

```bash
git add apps/web/src/app/admin apps/web/src/app/workbench/apps/page.tsx apps/web/src/app/globals.css
git commit -m "feat(web): admin image-studio models and catalog card"
```

---

### Task 9: Web — 项目库 UI（Layerive 风格裁剪）

**Files:**
- Create: `apps/web/src/components/image-studio/NOTICE`（一行：Based on Layerive, LGPL-3.0, https://github.com/newljs/Layerive）
- Create: `apps/web/src/components/image-studio/types.ts`
- Create: `apps/web/src/components/image-studio/project-library.tsx`
- Create: `apps/web/src/components/image-studio/image-studio-app.tsx`
- Create: `apps/web/src/app/workbench/apps/image-studio/page.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- App 状态：`view: 'library' | 'workspace'` + `projectId`
- Library：列表、搜索（前端 filter name）、新建对话框、收藏、软删、进入项目

- [ ] **Step 1: Shell page**

```tsx
'use client';
import { ImageStudioApp } from '@/components/image-studio/image-studio-app';
export default function Page() {
  return <ImageStudioApp />;
}
```

- [ ] **Step 2: Library**

`apiFetch` 对接 Task 5 API；空态引导新建；卡片显示封面（若有 `coverObjectKey` 则需 cover 对应 asset id——若仅有 objectKey，列表接口应返回 `coverAssetId` 或 `currentAssetId` 供 content URL）。

**补强：** `projects.list` serialize 增加 `currentAssetId`、可选 `coverContentPath`。若只有 `coverObjectKey`，增加字段 `coverAssetId`（查找 selected/current asset）——在 projects service `serialize` 中返回 `currentAssetId`。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/image-studio apps/web/src/app/workbench/apps/image-studio apps/web/src/app/globals.css
git commit -m "feat(web): image-studio project library"
```

---

### Task 10: Web — 工作台（对话 + 画布 + 生成）

**Files:**
- Create: `apps/web/src/components/image-studio/workspace.tsx`
- Create: `apps/web/src/components/image-studio/model-picker.tsx`
- Create: `apps/web/src/components/image-studio/asset-img.tsx`（拼 access_token）
- Modify: `image-studio-app.tsx`, `globals.css`

**Interfaces:**
- 顶栏：返回项目库、模型下拉（`GET models`）、n=1..4  
- 主区：当前图（`currentAssetId`）  
- 侧栏/底栏：turns 列表（prompt + 缩略图候选）  
- 发送：`POST generate` → 每 1s 轮询 `GET turns/:id` 至多 120 次 → 刷新 turns + project  
- 点候选：`POST .../assets/:id/select`  
- 上传参考图按钮 → `upload` → 设为 current 或作为下次 source  

- [ ] **Step 1: asset-img**

从 `useAuth` 取 token，渲染：

```tsx
<img src={`/api/apps/image-studio/assets/${id}/content?access_token=${encodeURIComponent(token)}`} alt="" />
```

（确认 web proxy `/api/*` 已转发到 Nest。）

- [ ] **Step 2: Workspace UX**

参考 Layerive 三区布局但保持 workbench 简洁：左/下对话，右/中画布。生成中禁用发送并显示 turn status。

- [ ] **Step 3: 端到端手验清单**

1. 管理员配置模型并设默认、测试  
2. 用户打开图工作室 → 建项目 → 文生图 → 选图 → 图生图  
3. 另一用户不可见该项目  
4. Admin 禁用应用后 Forbidden  

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/image-studio apps/web/src/app/globals.css
git commit -m "feat(web): image-studio workspace generate and gallery"
```

---

### Task 11: Dev notes + smoke script（可选但推荐）

**Files:**
- Modify: `docs/dev-setup.md`（图工作室一句：Admin 配图像模型后使用）
- Create: `scripts/smoke-image-studio.sh`（register/login → ensure admin model skip if none → create project；无真实 Key 时跳过 generate）

- [ ] **Step 1: 文档短注**

- [ ] **Step 2: Commit**

```bash
git add docs/dev-setup.md scripts/smoke-image-studio.sh
git commit -m "docs: note image-studio setup and smoke script"
```

---

## Spec coverage checklist

| Spec 项 | Task |
|---------|------|
| AppRegistry soft-seed / ACL / enabled | 3 |
| ImageStudioModel admin CRUD + test + default | 4, 8 |
| 用户可切换模型 | 5, 7, 10 |
| Project / Turn / Asset + MinIO | 2, 6, 7 |
| 文生图/图生图 + n≤4 + 轮询 | 7, 10 |
| 每用户隔离 | 5, 6, 7 |
| 用户 UI 项目库+工作台 | 9, 10 |
| Admin UI | 8 |
| MVP 不做高级编辑 | 不设任务 |
| LGPL NOTICE | 9 |
| openai_compatible 优先 | 7 |

---

## Self-review notes

- Asset `currentAssetId` 无 FK：已在 Task 2 写明，避免循环依赖。  
- img 鉴权：Task 6 固定 `access_token` query，与现有 SSE 模式一致。  
- 无自动化单测：与 handbook/stickies 计划一致，用 lint + 手验。  
- Registry `defaultModelConfigId`（聊天模型）**不用于**图工作室；默认图像模型只用 `ImageStudioModel.isDefault`。
