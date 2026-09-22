import type { PaymentAccountInfo } from '@/lib/format/payment-account';

/** Structured bank details, plus a QR image when the account has one (VND accounts only). */
export function PaymentAccountDetails({ account }: { account: PaymentAccountInfo }) {
  return (
    <div className="flex flex-wrap items-start gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-gray-500">Ngân hàng</dt>
        <dd>{account.bankName}</dd>
        {account.branchName && (
          <>
            <dt className="text-gray-500">Chi nhánh</dt>
            <dd>{account.branchName}</dd>
          </>
        )}
        <dt className="text-gray-500">Số tài khoản</dt>
        <dd>{account.accountNumber}</dd>
        <dt className="text-gray-500">Chủ tài khoản</dt>
        <dd>{account.accountHolderName}</dd>
      </dl>
      {account.qrImagePath && (
        // eslint-disable-next-line @next/next/no-img-element -- static project asset, path is dynamic per account
        <img src={account.qrImagePath} alt="Mã QR nhận tiền" className="h-32 w-32 rounded-md border border-gray-200 object-contain" />
      )}
    </div>
  );
}
