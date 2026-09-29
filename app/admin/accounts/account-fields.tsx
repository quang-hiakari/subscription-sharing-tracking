'use client';

import { useState } from 'react';
import { Field, SelectField } from '@/components/ui/fields';
import { CURRENCY_OPTIONS } from '@/lib/currency-options';
import type { Currency } from '@/lib/db-schema';

interface Defaults {
  currency?: string;
  label?: string;
  bankName?: string;
  branchName?: string | null;
  accountNumber?: string;
  accountHolderName?: string;
  qrImagePath?: string | null;
}

/** Bank fields change by country (currency doubles as country): Japan needs a branch name, Vietnam allows a QR image path. */
export function AccountFields({ defaults = {} }: { defaults?: Defaults }) {
  const [currency, setCurrency] = useState<Currency>((defaults.currency as Currency) ?? 'JPY');
  const [qrPath, setQrPath] = useState(defaults.qrImagePath ?? '');

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Loại tiền"
          name="currency"
          options={CURRENCY_OPTIONS}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
        />
        <Field label="Tên tài khoản (nội bộ)" name="label" required maxLength={100} defaultValue={defaults.label} placeholder="Yucho cá nhân, VCB..." hint="Chỉ để bạn phân biệt các tài khoản, không hiện cho thành viên." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tên ngân hàng / ví" name="bankName" required maxLength={100} defaultValue={defaults.bankName} placeholder="Yucho, PayPay..." />
        {currency === 'JPY' && (
          <Field
            label="Tên chi nhánh (支店名)"
            name="branchName"
            maxLength={100}
            defaultValue={defaults.branchName ?? ''}
            hint="Để trống nếu không có chi nhánh (PayPay, ví điện tử...)."
          />
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Số tài khoản"
          name="accountNumber"
          required
          maxLength={50}
          defaultValue={defaults.accountNumber}
          hint={currency === 'JPY' ? 'Số tài khoản ngân hàng, hoặc số điện thoại nếu là PayPay/ví điện tử.' : undefined}
        />
        <Field label="Tên chủ tài khoản" name="accountHolderName" required maxLength={100} defaultValue={defaults.accountHolderName} />
      </div>
      {currency === 'VND' && (
        <div className="space-y-2">
          <Field
            label="Đường dẫn ảnh QR (tuỳ chọn)"
            name="qrImagePath"
            value={qrPath}
            onChange={(e) => setQrPath(e.target.value)}
            placeholder="/qr/vcb-tai-khoan.png"
            hint="Thêm file ảnh vào public/qr/ trong project trước, rồi nhập đường dẫn dạng /qr/ten-file.png."
          />
          {qrPath && (
            // eslint-disable-next-line @next/next/no-img-element -- static project asset, path is user input, not a next/image-optimizable literal
            <img key={qrPath} src={qrPath} alt="Xem trước mã QR" className="h-24 w-24 rounded-md border border-gray-200 object-contain bg-gray-50" />
          )}
        </div>
      )}
    </>
  );
}
