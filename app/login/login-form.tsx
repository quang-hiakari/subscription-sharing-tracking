'use client';

import { useState } from 'react';
import { requestLogin, verifyCode } from './actions';

const inputClass = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base';
const buttonClass =
  'w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';

export function LoginForm({ linkFailed }: { linkFailed: boolean }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(
    linkFailed ? 'Link đã hết hạn hoặc đã được dùng. Hãy gửi lại hoặc nhập mã 6 số trong email.' : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await requestLogin(email);
    setLoading(false);
    if (result.error) setError(result.error);
    else setStep('code');
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // On success the server redirects, so this only returns on error.
    const result = await verifyCode(email, code);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Đăng nhập</h1>
      {error && <p className="mb-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {step === 'email' ? (
        <form onSubmit={onSend} className="space-y-3">
          <p className="text-sm text-gray-500">Nhập email, bạn sẽ nhận link đăng nhập.</p>
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'Đang gửi...' : 'Gửi link đăng nhập'}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="space-y-3">
          <p className="text-sm text-gray-500">
            Nếu email này được phép đăng nhập, thư đã được gửi tới <strong>{email}</strong>. Bấm link trong thư, hoặc nhập mã 6 số:
          </p>
          <input
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} text-center tracking-widest`}
          />
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'Đang xác nhận...' : 'Xác nhận mã'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
            className="w-full text-sm text-blue-600 hover:underline"
          >
            Gửi lại / đổi email
          </button>
        </form>
      )}
    </div>
  );
}
