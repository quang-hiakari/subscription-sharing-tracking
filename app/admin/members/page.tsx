import Link from 'next/link';
import { Badge, EmptyState, PageHeader, TableWrap, td, th } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import { listMembers } from '@/lib/queries/admin';

export const runtime = 'edge';

export default async function MembersPage() {
  await requireAdmin();
  const rows = await listMembers();

  return (
    <>
      <PageHeader title="Người dùng" action={{ href: '/admin/members/new', label: 'Thêm người' }} />
      {rows.length === 0 ? (
        <EmptyState>Chưa có ai. Thêm người để họ có thể đăng nhập bằng email.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Tên</th>
              <th className={th}>Email</th>
              <th className={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td className={td}>
                  <Link href={`/admin/members/${m.id}`} className="font-medium text-blue-700 hover:underline">{m.name}</Link>
                </td>
                <td className={td}>{m.email}</td>
                <td className={td}>{m.archived ? <Badge>Đã ẩn</Badge> : <Badge tone="green">Đang dùng</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
