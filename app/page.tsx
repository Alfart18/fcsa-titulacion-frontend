// Archivo: app/page.tsx
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

async function RootRedirect(): Promise<never> {
  const cookieStore = await cookies();
  const token = cookieStore.get('fcsa_token')?.value;
  return redirect(token ? '/dashboard' : '/login');
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <RootRedirect />
    </Suspense>
  );
}
