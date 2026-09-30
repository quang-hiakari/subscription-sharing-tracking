import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';
import { formatAccountLines, formatPaymentOptions } from './payment-account';

const jp = {
  currency: 'JPY' as const,
  bankName: 'Yucho',
  branchName: '008',
  accountNumber: '1234567',
  accountHolderName: 'NGUYEN VAN A',
  qrImagePath: null,
};

const vn = {
  currency: 'VND' as const,
  bankName: 'Vietcombank',
  branchName: null,
  accountNumber: '0123456789',
  accountHolderName: 'NGUYEN VAN A',
  qrImagePath: '/qr/vcb.png',
};

describe('formatAccountLines', () => {
  it('includes the branch for a Japan account', () => {
    expect(formatAccountLines(jp)).toEqual([
      'Ngân hàng: Yucho',
      'Chi nhánh: 008',
      'Số tài khoản: 1234567',
      'Chủ tài khoản: NGUYEN VAN A',
    ]);
  });

  it('omits the branch and notes the QR for a Vietnam account with one', () => {
    expect(formatAccountLines(vn)).toEqual([
      'Ngân hàng: Vietcombank',
      'Số tài khoản: 0123456789',
      'Chủ tài khoản: NGUYEN VAN A',
      '(Có mã QR trong app, đăng nhập để xem)',
    ]);
  });

  it('says nothing about a QR when there is none', () => {
    expect(formatAccountLines({ ...vn, qrImagePath: null })).not.toContain('(Có mã QR trong app, đăng nhập để xem)');
  });
});

describe('formatPaymentOptions', () => {
  it('lists each account with the amount to send into it, separated by a blank line', () => {
    const lines = formatPaymentOptions([
      { currency: 'JPY', amount: 300, account: jp },
      { currency: 'VND', amount: 49_620, account: vn },
    ]);
    expect(lines).toEqual([
      `Số tiền: ${formatMoney(300, 'JPY')}`,
      'Ngân hàng: Yucho',
      'Chi nhánh: 008',
      'Số tài khoản: 1234567',
      'Chủ tài khoản: NGUYEN VAN A',
      '',
      `Số tiền: ${formatMoney(49_620, 'VND')}`,
      'Ngân hàng: Vietcombank',
      'Số tài khoản: 0123456789',
      'Chủ tài khoản: NGUYEN VAN A',
      '(Có mã QR trong app, đăng nhập để xem)',
    ]);
  });

  it('says the rate is unknown instead of an amount when a conversion could not be made', () => {
    expect(formatPaymentOptions([{ currency: 'VND', amount: null, account: vn }])[0]).toBe('Số tiền: chưa có tỷ giá quy đổi');
  });
});
