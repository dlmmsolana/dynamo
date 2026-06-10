import { Suspense } from 'react';
import AuditorClient from './AuditorClient';

export default function AuditorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-dim)' }}>Loading...</div>}>
      <AuditorClient />
    </Suspense>
  );
}
