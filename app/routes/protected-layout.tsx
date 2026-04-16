import { Outlet } from 'react-router';
import { AuthGuard } from '~/components/auth-guard';

export default function ProtectedLayout() {
  return (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  );
}
