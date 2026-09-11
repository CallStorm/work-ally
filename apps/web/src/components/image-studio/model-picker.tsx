'use client';

import type { ImageStudioPublicModel } from './types';

type Props = {
  models: ImageStudioPublicModel[];
  modelId: string;
  onModelChange: (id: string) => void;
  n: number;
  onNChange: (n: number) => void;
  disabled?: boolean;
};

export function ModelPicker({
  models,
  modelId,
  onModelChange,
  n,
  onNChange,
  disabled,
}: Props) {
  return (
    <div className="image-studio-model-picker">
      <label className="image-studio-model-picker__field">
        <span>模型</span>
        <select
          value={modelId}
          disabled={disabled || models.length === 0}
          onChange={(e) => onModelChange(e.target.value)}
          aria-label="选择图像模型"
        >
          {models.length === 0 ? (
            <option value="">暂无可用模型</option>
          ) : (
            models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.isDefault ? '（默认）' : ''}
              </option>
            ))
          )}
        </select>
      </label>
      <label className="image-studio-model-picker__field">
        <span>数量</span>
        <select
          value={n}
          disabled={disabled}
          onChange={(e) => onNChange(Number(e.target.value))}
          aria-label="生成数量"
        >
          {[1, 2, 3, 4].map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
