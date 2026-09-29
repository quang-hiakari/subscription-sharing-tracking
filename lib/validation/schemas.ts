import { z } from 'zod';
import { BILLING_CYCLES, CURRENCIES } from '@/lib/db-schema';
import { isValidDate } from '@/lib/format/date';
import { MAX_MONTHS_PER_PAYMENT } from '@/lib/payments/service';

// Form schemas. Input comes from FormData, so numbers arrive as strings.
// Messages are user-facing (Vietnamese).

const currency = z.enum(CURRENCIES, { errorMap: () => ({ message: 'Chọn loại tiền' }) });
const id = (msg: string) => z.coerce.number({ invalid_type_error: msg }).int(msg).positive(msg);
const money = (msg: string) => z.coerce.number({ invalid_type_error: msg }).int(msg);
// Missing and blank both mean "not provided".
const emptyToNull = (v: unknown) => (v == null || (typeof v === 'string' && v.trim() === '') ? null : v);

// Bank fields differ by country: currency doubles as the country (JPY = Japan, VND = Vietnam).
// qrImagePath points at a static file under public/ (added to the repo, not uploaded here).
const QR_PATH_RE = /^\/qr\/[\w.-]+\.(png|jpe?g|webp)$/i;
export const paymentAccountSchema = z
  .object({
    currency,
    label: z.string().trim().min(1, 'Nhập tên tài khoản').max(100),
    bankName: z.string().trim().min(1, 'Nhập tên ngân hàng').max(100),
    // Optional; some JPY methods (PayPay, other e-wallets) have no branch. Always absent for VND.
    branchName: z.preprocess(emptyToNull, z.string().trim().max(100).nullable()),
    accountNumber: z.string().trim().min(1, 'Nhập số tài khoản').max(50),
    accountHolderName: z.string().trim().min(1, 'Nhập tên chủ tài khoản').max(100),
    // VND only, optional; enforced below since it depends on currency.
    qrImagePath: z.preprocess(
      emptyToNull,
      z.string().trim().regex(QR_PATH_RE, 'Đường dẫn phải dạng /qr/ten-file.png (đã thêm file vào public/qr/)').nullable(),
    ),
  })
  .transform((data) => ({
    ...data,
    branchName: data.currency === 'JPY' ? data.branchName : null,
    qrImagePath: data.currency === 'VND' ? data.qrImagePath : null,
  }));

// The admin enters one amount in whichever cycle they picked, exactly as-is — no conversion.
// A "per month/year, per person" reference is computed on read (see subscription-reference.ts),
// never stored.
const billingCycle = z.enum(BILLING_CYCLES, { errorMap: () => ({ message: 'Chọn chu kỳ trả tiền' }) });

export const subscriptionSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên subscription').max(100),
  currency,
  billingCycle,
  billingAmount: money('Số tiền không hợp lệ').positive('Số tiền phải lớn hơn 0'),
  slotCount: id('Số slot không hợp lệ'),
  paymentAccountId: id('Chọn tài khoản nhận tiền'),
  // Empty input means "use the default lead time".
  remindDaysBefore: z.preprocess(
    (v) => (v === '' || v == null ? null : v),
    z.coerce.number({ invalid_type_error: 'Số ngày nhắc không hợp lệ' }).int('Số ngày nhắc không hợp lệ').min(0, 'Số ngày nhắc không hợp lệ').max(60, 'Tối đa 60 ngày').nullable(),
  ),
});

export const memberSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên thành viên').max(100),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
});

const dateString = z.string().refine(isValidDate, 'Ngày không hợp lệ');
const checkbox = z.preprocess((v) => v === 'on' || v === 'true', z.boolean());

export const membershipCreateSchema = z.object({
  memberId: id('Chọn thành viên'),
  subscriptionId: id('Chọn subscription'),
  monthlyShare: money('Số tiền mỗi tháng không hợp lệ').min(0, 'Số tiền mỗi tháng không hợp lệ'),
  isFamily: checkbox,
  paidThrough: dateString,
});

// Member and subscription are fixed once created; only terms can change.
export const membershipUpdateSchema = membershipCreateSchema.pick({
  monthlyShare: true,
  isFamily: true,
  paidThrough: true,
});

// Adding a member to a subscription: either an existing member (by id) or a brand-new one
// (name + email), plus the same terms as membershipUpdateSchema either way.
export const addMemberToSubscriptionSchema = z.discriminatedUnion('mode', [
  membershipUpdateSchema.extend({ mode: z.literal('existing'), memberId: id('Chọn thành viên') }),
  membershipUpdateSchema.extend({
    mode: z.literal('new'),
    name: z.string().trim().min(1, 'Nhập tên thành viên').max(100),
    email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  }),
]);

export type ParseResult<T> = { data: T } | { error: string };

/** Parses FormData with a schema; returns the first user-facing error message. */
export function parseForm<S extends z.ZodTypeAny>(schema: S, formData: FormData): ParseResult<z.output<S>> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (parsed.success) return { data: parsed.data };
  return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
}

// A payment a member reports or an admin records. Empty amount means "monthly share x months".
export const paymentInputSchema = z.object({
  monthsCovered: z.coerce
    .number({ invalid_type_error: 'Số tháng không hợp lệ' })
    .int('Số tháng không hợp lệ')
    .min(1, 'Số tháng không hợp lệ')
    .max(MAX_MONTHS_PER_PAYMENT, `Tối đa ${MAX_MONTHS_PER_PAYMENT} tháng`),
  amount: z.preprocess(
    emptyToNull,
    z.coerce.number({ invalid_type_error: 'Số tiền không hợp lệ' }).int('Số tiền không hợp lệ').positive('Số tiền phải lớn hơn 0').nullable(),
  ),
  note: z.preprocess(emptyToNull, z.string().trim().max(200, 'Ghi chú tối đa 200 ký tự').nullable()),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(1, 'Nhập lý do từ chối').max(200, 'Lý do tối đa 200 ký tự'),
});
