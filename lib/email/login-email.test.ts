import { describe, expect, it } from 'vitest';
import { buildLoginEmail } from './login-email';

describe('buildLoginEmail', () => {
  it('contains the link and the fallback code', () => {
    const { html } = buildLoginEmail({ url: 'https://app.example/api/auth/magic-link/verify?token=abc', otp: '123456', expiresInMinutes: 15 });
    expect(html).toContain('https://app.example/api/auth/magic-link/verify?token=abc');
    expect(html).toContain('123456');
    expect(html).toContain('15 phút');
  });

  it('omits the code block when there is no otp', () => {
    const { html } = buildLoginEmail({ url: 'https://app.example/x', expiresInMinutes: 15 });
    expect(html).not.toContain('Nhập mã');
  });

  it('escapes html in url and otp', () => {
    const { html } = buildLoginEmail({ url: 'https://x/?a=1&b="2"', otp: '<b>1</b>', expiresInMinutes: 15 });
    expect(html).toContain('a=1&amp;b=&quot;2&quot;');
    expect(html).not.toContain('<b>1</b>');
  });
});
