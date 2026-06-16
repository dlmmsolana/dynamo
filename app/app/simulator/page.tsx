import { Suspense } from 'react';
import SimulatorClient from './SimulatorClient';

export default function SimulatorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-dim)' }}>Loading...</div>}>
      <SimulatorClient />
    </Suspense>
  );
}
