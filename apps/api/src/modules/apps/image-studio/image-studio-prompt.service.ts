import { Injectable } from '@nestjs/common';
import type { EnhanceImageStudioPromptInput } from '@work-ally/shared';
import type { AuthUser } from '../../../common/current-user.decorator';
import { ModelsService } from '../../models/models.service';

const SYSTEM = `你是海报/营销图的文生图提示词助手。
任务：把用户的短句草稿扩写成一条适合图像模型的「画面描述」提示词。
硬性规则：
1. 只写视觉：场景、主体、构图、光影、色彩、材质、风格、氛围。
2. 不要要求画面里出现任何文字、汉字、字母、数字、招牌或标题（标题由系统另叠）。
3. 不要输出解释、编号、引号或 markdown，只输出一条提示词正文。
4. 中文输出，约 80～220 字，信息密度高但不要堆砌无关词。
5. 禁止写入画幅、比例、尺寸（如 3:4、16:9、竖版/横版像素）；画幅由界面单独控制。`;

@Injectable()
export class ImageStudioPromptService {
  constructor(private readonly models: ModelsService) {}

  async enhance(user: AuthUser, input: EnhanceImageStudioPromptInput) {
    const lines = [`草稿：${input.draft.trim()}`];
    const title = input.overlayTitle?.trim();
    const subtitle = input.overlaySubtitle?.trim();
    if (title) {
      lines.push(
        `海报标题（勿写入画面文字，仅作主题参考）：${title}${subtitle ? ` / ${subtitle}` : ''}`,
      );
    }
    lines.push('请输出优化后的画面描述提示词：');

    const raw = await this.models.completeChat({
      tenantId: user.tenantId,
      system: SYSTEM,
      user: lines.join('\n'),
      maxTokens: 512,
    });

    return { prompt: sanitizeEnhancedPrompt(raw) };
  }
}

export function sanitizeEnhancedPrompt(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text
      .replace(/^```(?:\w+)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith('“') && text.endsWith('”')) ||
    (text.startsWith('「') && text.endsWith('」'))
  ) {
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/^(优化后的?(画面描述|提示词)[:：]\s*)/i, '').trim();
  // Strip accidental aspect-ratio / size chatter — ratio comes from the UI picker
  text = text
    .replace(/\b\d{1,2}\s*[:：]\s*\d{1,2}(?:\s*(?:竖版|横版|画幅|比例|构图))?/g, '')
    .replace(/(?:画幅|比例|尺寸)\s*[:：]?\s*[^，。；\n]*/g, '')
    .replace(/[，、]\s*[，、]+/g, '，')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (text.length > 4000) text = text.slice(0, 4000);
  return text;
}
