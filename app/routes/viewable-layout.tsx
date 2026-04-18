import { Outlet } from 'react-router';
import { useAuthStore } from '~/stores/auth-store';
import { ViewModeProvider } from '~/components/view-mode';

export default function ViewableLayout() {
  const { isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ViewModeProvider>
      <Outlet />
    </ViewModeProvider>
  );
}
