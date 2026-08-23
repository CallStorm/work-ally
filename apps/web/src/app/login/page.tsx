'use client';

import { FormEvent, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('办公同学');
  const [tenantName, setTenantName] = useState('演示公司');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(phone, password);
      } else {
        await register({ phone, password, name, tenantName });
      }
      router.replace('/workbench');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: 'min(420px, 100%)',
          background: '#fff',
          border: '1px solid var(--line)',
          borderRadius: 18,
          padding: 28,
          display: 'grid',
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontFamily: 'Fraunces, Georgia, serif' }}>
          {mode === 'login' ? '登录 WorkAlly' : '注册并创建租户'}
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
          使用手机号登录；注册会自动创建默认组与默认 Agent。
        </p>
        {mode === 'register' && (
          <>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的名字"
              style={inputStyle}
            />
            <input
              required
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="公司名称"
              style={inputStyle}
            />
          </>
        )}
        <input
          required
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="手机号"
          style={inputStyle}
        />
        <input
          required
          type="password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          style={inputStyle}
        />
        {error && (
          <div style={{ color: '#b42318', fontSize: 14 }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            border: 'none',
            borderRadius: 999,
            padding: '12px 16px',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {loading ? '处理中…' : mode === 'login' ? '登录' : '注册并进入'}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--accent)',
            cursor: 'pointer',
          }}
        >
          {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
        </button>
      </form>
    </main>
  );
}

const inputStyle: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: '12px 14px',
  font: 'inherit',
};
