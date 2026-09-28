'use client';

import { useState } from 'react';
import { Field, SelectField } from '@/components/ui/fields';
import { MembershipTermsFields } from '@/app/admin/memberships/membership-fields';

interface AvailableMember {
  id: number;
  name: string;
  email: string;
}

/** Toggle between picking an existing member and creating a brand-new one; terms (share/family/date) are shared either way. */
export function AddMemberForm({ availableMembers, paidThrough }: { availableMembers: AvailableMember[]; paidThrough: string }) {
  const [mode, setMode] = useState<'existing' | 'new'>(availableMembers.length > 0 ? 'existing' : 'new');

  return (
    <>
      {availableMembers.length > 0 && (
        <fieldset className="flex gap-4 text-sm">
          <legend className="mb-1 text-sm font-medium">Thành viên</legend>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="mode" value="existing" checked={mode === 'existing'} onChange={() => setMode('existing')} />
            Người có sẵn
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="mode" value="new" checked={mode === 'new'} onChange={() => setMode('new')} />
            Người mới
          </label>
        </fieldset>
      )}
      {availableMembers.length === 0 && <input type="hidden" name="mode" value="new" />}

      {mode === 'existing' ? (
        <SelectField
          label="Chọn người"
          name="memberId"
          options={availableMembers.map((m) => ({ value: m.id, label: `${m.name} (${m.email})` }))}
        />
      ) : (
        <>
          <Field label="Tên" name="name" required maxLength={100} />
          <Field label="Email" name="email" type="email" required autoComplete="off" />
        </>
      )}

      <MembershipTermsFields defaults={{ paidThrough }} />
    </>
  );
}
