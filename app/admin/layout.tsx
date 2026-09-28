import Link from 'next/link';

export const runtime = 'edge';

const NAV = [
  { href: '/admin', label: 'Tổng quan' },
  { href: '/admin/subscriptions', label: 'Subscription' },
  { href: '/admin/payments', label: 'Thanh toán' },
  { href: '/admin/members', label: 'Người dùng' },
  { href: '/admin/accounts', label: 'Tài khoản nhận tiền' },
];

// Navigation only. Access control is enforced by requireAdmin() in every page and action.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <nav className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 pb-3 text-sm">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="font-medium text-gray-700 hover:text-blue-700">
            {item.label}
          </Link>
        ))}
        <form action="/logout" method="post" className="ml-auto">
          <button type="submit" className="text-gray-500 hover:text-blue-700">Đăng xuất</button>
        </form>
      </nav>
      {children}
    </div>
  );
}
