import { CheckboxField, Field } from '@/components/ui/fields';

interface Defaults {
  monthlyShare?: number;
  isFamily?: boolean;
  paidThrough?: string;
}

/** Terms shared by the create and edit forms. */
export function MembershipTermsFields({ defaults = {} }: { defaults?: Defaults }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Số tiền mỗi tháng của người này"
          name="monthlyShare"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          required
          defaultValue={defaults.monthlyShare}
          hint="Theo loại tiền của subscription."
        />
        <Field
          label="Trả đến ngày (hạn thanh toán tiếp theo)"
          name="paidThrough"
          type="date"
          required
          defaultValue={defaults.paidThrough}
          hint="Đây là ngày đến hạn kế tiếp; sẽ tự dời khi thanh toán được duyệt."
        />
      </div>
      <CheckboxField
        label="Người nhà"
        name="isFamily"
        defaultChecked={defaults.isFamily}
        hint="Không bị nhắc và không tính là nợ."
      />
    </>
  );
}
