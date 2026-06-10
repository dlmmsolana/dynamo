import { Suspense } from 'react';
import ArchitectClient from './ArchitectClient';

export default function ArchitectPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-dim)' }}>Loading...</div>}>
      <ArchitectClient />
    </Suspense>
  );
}
