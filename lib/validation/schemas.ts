import { z } from 'zod';
import { CURRENCIES } from '@/lib/db-schema';
import { isValidDate } from '@/lib/format/date';
import { MAX_MONTHS_PER_PAYMENT } from '@/lib/payments/service';

// Form schemas. Input comes from FormData, so numbers arrive as strings.
// Messages are user-facing (Vietnamese).

const currency = z.enum(CURRENCIES, { errorMap: () => ({ message: 'Chọn loại tiền' }) });
const id = (msg: string) => z.coerce.number({ invalid_type_error: msg }).int(msg).positive(msg);
const money = (msg: string) => z.coerce.number({ invalid_type_error: msg }).int(msg);

export const paymentAccountSchema = z.object({
  currency,
  label: z.string().trim().min(1, 'Nhập tên tài khoản').max(100),
  details: z.string().trim().min(1, 'Nhập thông tin nhận tiền').max(500),
});

export const subscriptionSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên subscription').max(100),
  currency,
  pricePerMonth: money('Giá mỗi tháng không hợp lệ').positive('Giá mỗi tháng phải lớn hơn 0'),
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

export type ParseResult<T> = { data: T } | { error: string };

/** Parses FormData with a schema; returns the first user-facing error message. */
export function parseForm<S extends z.ZodTypeAny>(schema: S, formData: FormData): ParseResult<z.output<S>> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (parsed.success) return { data: parsed.data };
  return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
}

// Missing and blank both mean "not provided".
const emptyToNull = (v: unknown) => (v == null || (typeof v === 'string' && v.trim() === '') ? null : v);

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
