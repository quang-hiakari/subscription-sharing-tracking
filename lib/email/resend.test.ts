import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendViaResend } from './resend';

const config = { apiKey: 'key123', from: 'Tracker <noreply@example.org>' };
const mail = { to: 'an@x.com', subject: 'Hi', html: '<p>x</p>' };

afterEach(() => vi.unstubAllGlobals());

describe('sendViaResend', () => {
  it('posts JSON with the bearer key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendViaResend(config, mail);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer key123');
    expect(JSON.parse(init.body)).toEqual({ from: config.from, to: 'an@x.com', subject: 'Hi', html: '<p>x</p>' });
  });

  it("surfaces Resend's message on failure", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"domain not verified"}', { status: 403 })));
    await expect(sendViaResend(config, mail)).rejects.toThrow('Resend: domain not verified');
  });

  it('falls back to the HTTP status when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad gateway', { status: 502 })));
    await expect(sendViaResend(config, mail)).rejects.toThrow('Resend: HTTP 502');
  });
});
