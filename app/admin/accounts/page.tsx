import Link from 'next/link';
import { EmptyState, PageHeader, TableWrap, td, th } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import { listAccounts } from '@/lib/queries/admin';

export const runtime = 'edge';

export default async function AccountsPage() {
  await requireAdmin();
  const accounts = await listAccounts();

  return (
    <>
      <PageHeader title="Tài khoản nhận tiền" action={{ href: '/admin/accounts/new', label: 'Thêm tài khoản' }} />
      {accounts.length === 0 ? (
        <EmptyState>Chưa có tài khoản nào. Thêm tài khoản trước khi tạo subscription.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Tên</th>
              <th className={th}>Tiền</th>
              <th className={th}>Thông tin</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className={td}>
                  <Link href={`/admin/accounts/${a.id}`} className="font-medium text-blue-700 hover:underline">{a.label}</Link>
                </td>
                <td className={td}>{a.currency}</td>
                <td className={`${td} whitespace-pre-line`}>{a.details}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
