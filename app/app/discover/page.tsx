import { Suspense } from 'react';
import DiscoverClient from './DiscoverClient';

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-dim)' }}>Loading...</div>}>
      <DiscoverClient />
    </Suspense>
  );
}
