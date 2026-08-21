const experts = [
  '深度研究',
  '文档处理',
  '数据分析',
  '可视化',
  '产品助手',
];

export default function WorkbenchHomePage() {
  return (
    <main
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: 'min(860px, 100%)' }}>
        <h1
          style={{
            textAlign: 'center',
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
            marginBottom: 8,
          }}
        >
          WorkAlly，我帮你
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 24 }}>
          未选专家时使用全公司默认 Agent；选中专家后底部出现推荐提示词
        </p>

        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 12,
            marginBottom: 12,
          }}
        >
          {experts.map((name) => (
            <button
              key={name}
              type="button"
              style={{
                whiteSpace: 'nowrap',
                border: '1px solid var(--line)',
                background: '#fff',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              {name}
            </button>
          ))}
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 18,
            padding: 16,
            minHeight: 180,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <textarea
            placeholder="今天帮你做些什么？"
            style={{
              flex: 1,
              border: 'none',
              resize: 'none',
              outline: 'none',
              font: 'inherit',
              minHeight: 88,
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                title="+ 面板：文件 / 专家 / 技能 / 连接器 / 知识库"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: '1px solid var(--line)',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                +
              </button>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                专家 Tag 将出现在左下角（可 × 清除）
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                defaultValue="auto"
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 999,
                  padding: '8px 12px',
                  background: '#fff',
                }}
              >
                <option value="auto">Auto</option>
              </select>
              <button
                type="button"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: 'none',
                  background: 'var(--ink)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
                aria-label="发送"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
