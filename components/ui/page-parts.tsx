import Link from 'next/link';

export function PageHeader({ title, action }: { title: string; action?: { href: string; label: string } }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-xl font-semibold">{title}</h1>
      {action && (
        <Link href={action.href} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'red' | 'amber' | 'green' | 'blue' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-800',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">{children}</p>;
}

/** Scrollable table wrapper so wide tables work on phones. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
      <table className="w-full min-w-[32rem] text-left text-sm">{children}</table>
    </div>
  );
}

export const th = 'border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium text-gray-600';
export const td = 'border-b border-gray-100 px-3 py-2';
