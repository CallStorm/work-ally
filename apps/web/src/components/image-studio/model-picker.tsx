'use client';

import type { ImageStudioAspectRatio, ImageStudioPublicModel } from './types';

type Props = {
  models: ImageStudioPublicModel[];
  modelId: string;
  onModelChange: (id: string) => void;
  n: number;
  onNChange: (n: number) => void;
  aspectRatio: ImageStudioAspectRatio;
  onAspectRatioChange: (ratio: ImageStudioAspectRatio) => void;
  disabled?: boolean;
};

const ASPECT_OPTIONS: Array<{ value: ImageStudioAspectRatio; label: string }> =
  [
    { value: '1:1', label: '1:1 方图' },
    { value: '3:4', label: '3:4 竖版海报' },
    { value: '9:16', label: '9:16 长竖版' },
    { value: '4:3', label: '4:3 横版' },
    { value: '16:9', label: '16:9 宽屏' },
  ];

export function ModelPicker({
  models,
  modelId,
  onModelChange,
  n,
  onNChange,
  aspectRatio,
  onAspectRatioChange,
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
        <span>画幅</span>
        <select
          value={aspectRatio}
          disabled={disabled}
          onChange={(e) =>
            onAspectRatioChange(e.target.value as ImageStudioAspectRatio)
          }
          aria-label="画幅比例"
        >
          {ASPECT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
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
