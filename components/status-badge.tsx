import { Badge } from '@/components/ui/page-parts';
import type { MembershipStatus } from '@/lib/queries/membership-status';

export function StatusBadge({ status, daysUntilDue }: { status: MembershipStatus; daysUntilDue: number }) {
  switch (status) {
    case 'family':
      return <Badge tone="blue">Người nhà</Badge>;
    case 'overdue':
      return <Badge tone="red">Quá hạn {-daysUntilDue} ngày</Badge>;
    case 'due_soon':
      return <Badge tone="amber">{daysUntilDue === 0 ? 'Đến hạn hôm nay' : `Còn ${daysUntilDue} ngày`}</Badge>;
    default:
      return <Badge tone="green">Ổn</Badge>;
  }
}
