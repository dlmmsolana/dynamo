import { Suspense } from 'react';
import LiveLPClient from './LiveLPClient';

export default function LiveLPPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-dim)' }}>Loading...</div>}>
      <LiveLPClient />
    </Suspense>
  );
}
