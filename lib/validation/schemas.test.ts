import { describe, expect, it } from 'vitest';
import {
  memberSchema,
  membershipCreateSchema,
  membershipUpdateSchema,
  parseForm,
  paymentAccountSchema,
  paymentInputSchema,
  rejectSchema,
  subscriptionSchema,
} from './schemas';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe('paymentAccountSchema', () => {
  const jp = { currency: 'JPY', label: '  Yucho ', bankName: ' Yucho Bank ', branchName: ' 008 ', accountNumber: ' 1234567 ', accountHolderName: ' NGUYEN A ' };
  const vn = { currency: 'VND', label: 'VCB', bankName: 'Vietcombank', accountNumber: '0123456789', accountHolderName: 'NGUYEN A' };

  it('accepts a valid Japan account, trims, and keeps the branch', () => {
    expect(parseForm(paymentAccountSchema, fd(jp))).toEqual({
      data: { currency: 'JPY', label: 'Yucho', bankName: 'Yucho Bank', branchName: '008', accountNumber: '1234567', accountHolderName: 'NGUYEN A', qrImagePath: null },
    });
  });

  it('accepts a valid Vietnam account with no branch (nulled even if sent)', () => {
    expect(parseForm(paymentAccountSchema, fd({ ...vn, branchName: 'ignored' }))).toEqual({
      data: { currency: 'VND', label: 'VCB', bankName: 'Vietcombank', branchName: null, accountNumber: '0123456789', accountHolderName: 'NGUYEN A', qrImagePath: null },
    });
  });

  it('requires a branch for Japan but not for Vietnam', () => {
    expect(parseForm(paymentAccountSchema, fd({ ...jp, branchName: '' }))).toEqual({ error: 'Nhập tên chi nhánh' });
    expect('data' in parseForm(paymentAccountSchema, fd(vn))).toBe(true);
  });

  it('accepts a Vietnam QR path and rejects a malformed one', () => {
    expect(parseForm(paymentAccountSchema, fd({ ...vn, qrImagePath: '/qr/vcb-9999.png' }))).toMatchObject({
      data: { qrImagePath: '/qr/vcb-9999.png' },
    });
    expect('error' in parseForm(paymentAccountSchema, fd({ ...vn, qrImagePath: 'not-a-path' }))).toBe(true);
    expect('error' in parseForm(paymentAccountSchema, fd({ ...vn, qrImagePath: '/qr/x.gif' }))).toBe(true);
  });

  it('drops the QR path when the account is switched to Japan', () => {
    expect(parseForm(paymentAccountSchema, fd({ ...jp, qrImagePath: '/qr/leftover.png' }))).toMatchObject({
      data: { qrImagePath: null },
    });
  });

  it('rejects unsupported currency and empty fields', () => {
    expect(parseForm(paymentAccountSchema, fd({ ...vn, currency: 'USD' }))).toEqual({ error: 'Chọn loại tiền' });
    expect(parseForm(paymentAccountSchema, fd({ ...vn, label: '  ' }))).toEqual({ error: 'Nhập tên tài khoản' });
    expect(parseForm(paymentAccountSchema, fd({ ...vn, bankName: '' }))).toEqual({ error: 'Nhập tên ngân hàng' });
    expect(parseForm(paymentAccountSchema, fd({ ...vn, accountNumber: '' }))).toEqual({ error: 'Nhập số tài khoản' });
    expect(parseForm(paymentAccountSchema, fd({ ...vn, accountHolderName: '' }))).toEqual({ error: 'Nhập tên chủ tài khoản' });
  });
});

describe('subscriptionSchema', () => {
  const valid = { name: 'Youtube', currency: 'JPY', pricePerMonth: '300', paymentAccountId: '1', remindDaysBefore: '' };

  it('coerces numbers and maps empty lead time to null', () => {
    expect(parseForm(subscriptionSchema, fd(valid))).toEqual({
      data: { name: 'Youtube', currency: 'JPY', pricePerMonth: 300, paymentAccountId: 1, remindDaysBefore: null },
    });
  });

  it('keeps an explicit lead time including 0', () => {
    const r = parseForm(subscriptionSchema, fd({ ...valid, remindDaysBefore: '0' }));
    expect(r).toMatchObject({ data: { remindDaysBefore: 0 } });
  });

  it('rejects non-positive price, fractional price and out-of-range lead time', () => {
    expect('error' in parseForm(subscriptionSchema, fd({ ...valid, pricePerMonth: '0' }))).toBe(true);
    expect('error' in parseForm(subscriptionSchema, fd({ ...valid, pricePerMonth: '10.5' }))).toBe(true);
    expect('error' in parseForm(subscriptionSchema, fd({ ...valid, remindDaysBefore: '-1' }))).toBe(true);
    expect('error' in parseForm(subscriptionSchema, fd({ ...valid, remindDaysBefore: '61' }))).toBe(true);
  });

  it('requires a payment account', () => {
    expect(parseForm(subscriptionSchema, fd({ ...valid, paymentAccountId: '' }))).toEqual({ error: 'Chọn tài khoản nhận tiền' });
  });
});

describe('memberSchema', () => {
  it('lowercases and trims email', () => {
    expect(parseForm(memberSchema, fd({ name: ' An ', email: '  An@Example.COM ' }))).toEqual({
      data: { name: 'An', email: 'an@example.com' },
    });
  });

  it('rejects bad email', () => {
    expect(parseForm(memberSchema, fd({ name: 'An', email: 'nope' }))).toEqual({ error: 'Email không hợp lệ' });
  });
});

describe('paymentInputSchema', () => {
  it('treats blank and missing amount/note as null', () => {
    expect(parseForm(paymentInputSchema, fd({ monthsCovered: '6', amount: '', note: '  ' }))).toEqual({
      data: { monthsCovered: 6, amount: null, note: null },
    });
    expect(parseForm(paymentInputSchema, fd({ monthsCovered: '6' }))).toEqual({
      data: { monthsCovered: 6, amount: null, note: null },
    });
  });

  it('keeps explicit amount and trims note', () => {
    expect(parseForm(paymentInputSchema, fd({ monthsCovered: '12', amount: '3000', note: ' cash ' }))).toEqual({
      data: { monthsCovered: 12, amount: 3000, note: 'cash' },
    });
  });

  it('rejects out-of-range months and bad amounts', () => {
    expect(parseForm(paymentInputSchema, fd({ monthsCovered: '0' }))).toEqual({ error: 'Số tháng không hợp lệ' });
    expect(parseForm(paymentInputSchema, fd({ monthsCovered: '37' }))).toEqual({ error: 'Tối đa 36 tháng' });
    expect(parseForm(paymentInputSchema, fd({ monthsCovered: '1', amount: '0' }))).toEqual({ error: 'Số tiền phải lớn hơn 0' });
    expect(parseForm(paymentInputSchema, fd({ monthsCovered: '1', amount: '9.5' }))).toEqual({ error: 'Số tiền không hợp lệ' });
    expect('error' in parseForm(paymentInputSchema, fd({ monthsCovered: '1', note: 'x'.repeat(201) }))).toBe(true);
  });
});

describe('rejectSchema', () => {
  it('requires a reason', () => {
    expect(parseForm(rejectSchema, fd({ reason: '  ' }))).toEqual({ error: 'Nhập lý do từ chối' });
    expect(parseForm(rejectSchema, fd({ reason: ' sai số tiền ' }))).toEqual({ data: { reason: 'sai số tiền' } });
  });
});

describe('membershipSchema', () => {
  const valid = { memberId: '2', subscriptionId: '3', monthlyShare: '300', paidThrough: '2026-10-01' };

  it('parses checkbox on/absent', () => {
    expect(parseForm(membershipCreateSchema, fd({ ...valid, isFamily: 'on' }))).toMatchObject({ data: { isFamily: true } });
    expect(parseForm(membershipCreateSchema, fd(valid))).toMatchObject({ data: { isFamily: false, memberId: 2, subscriptionId: 3 } });
  });

  it('allows a zero share but not negative', () => {
    expect('data' in parseForm(membershipCreateSchema, fd({ ...valid, monthlyShare: '0' }))).toBe(true);
    expect('error' in parseForm(membershipCreateSchema, fd({ ...valid, monthlyShare: '-5' }))).toBe(true);
  });

  it('rejects impossible dates', () => {
    expect(parseForm(membershipCreateSchema, fd({ ...valid, paidThrough: '2026-02-30' }))).toEqual({ error: 'Ngày không hợp lệ' });
    expect('error' in parseForm(membershipCreateSchema, fd({ ...valid, paidThrough: '' }))).toBe(true);
  });

  it('update schema ignores member/subscription ids', () => {
    const r = parseForm(membershipUpdateSchema, fd({ ...valid, memberId: '999' }));
    expect(r).toEqual({ data: { monthlyShare: 300, isFamily: false, paidThrough: '2026-10-01' } });
  });
});
