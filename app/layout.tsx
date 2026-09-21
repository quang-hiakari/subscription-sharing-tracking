import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chia sẻ subscription',
  description: 'Theo dõi thanh toán chia sẻ subscription',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
