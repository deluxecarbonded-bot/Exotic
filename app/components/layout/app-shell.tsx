import { Link, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ExoticLogo, ExoticWordmark } from '~/components/logo';
import {
  IconHome,
  IconInbox,
  IconCompass,
  IconBell,
  IconUser,
  IconSearch,
  IconSun,
  IconMoon,
  IconSettings,
  IconImage,
  IconRadio,
  IconPlay,
  IconCrown,
} from '~/components/icons';
import { useThemeStore } from '~/stores/theme-store';
import { useNotificationStore } from '~/stores/notification-store';
import { useLiveStore } from '~/stores/live-store';
import { useRealtimeSubscriptions } from '~/hooks/use-realtime';
import { useAuthStore } from '~/stores/auth-store';
import { type ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { resolved, toggle } = useThemeStore();
  const { unreadCount } = useNotificationStore();
  const liveCount = useLiveStore((s) => s.liveCount);
  const { user } = useAuthStore();
  useRealtimeSubscriptions();

  const navItems = [
    { path: '/', icon: IconHome, label: 'Home' },
    { path: '/search', icon: IconSearch, label: 'Search' },
    { path: '/inbox', icon: IconInbox, label: 'Inbox' },
    { path: '/discover', icon: IconCompass, label: 'Discover' },
    { path: '/posts', icon: IconImage, label: 'Posts' },
    { path: '/live', icon: IconRadio, label: 'Live' },
    { path: '/showcase', icon: IconPlay, label: 'Showcase' },
    { path: '/notifications', icon: IconBell, label: 'Notifications' },
    { path: '/profile/me', icon: IconUser, label: 'Profile' },
    ...(user?.is_owner ? [{ path: '/owner-dashboard', icon: IconCrown, label: 'Owner' }] : []),
    { path: '/settings', icon: IconSettings, label: 'Settings' },
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar - hidden on mobile/tablet */}
      <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 z-40 w-64 flex-col bg-background">
        {/* Logo */}
        <div className="flex items-center gap-2.5 h-16 px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <ExoticLogo size={28} />
            <ExoticWordmark />
          </Link>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <div className="relative">
                  <item.icon size={20} />
                  {item.label === 'Notifications' && unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-destructive text-white"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                  {item.label === 'Live' && liveCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-red-500 text-white"
                    >
                      {liveCount > 9 ? '9+' : liveCount}
                    </motion.span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section: Theme toggle */}
        <div className="p-3">
          <button
            onClick={toggle}
            className="ghost-btn flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <AnimatePresence mode="wait">
              {resolved === 'dark' ? (
                <IconSun
                  key="sun"
                  size={20}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              ) : (
                <IconMoon
                  key="moon"
                  size={20}
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </AnimatePresence>
            <span>{resolved === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile/Tablet Header - hidden on desktop */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 backdrop-blur-xl">
        <div className="flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <ExoticLogo size={24} />
            <ExoticWordmark className="text-base" />
          </Link>
          <button
            onClick={toggle}
            className="ghost-btn p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            <AnimatePresence mode="wait">
              {resolved === 'dark' ? (
                <IconSun
                  key="sun"
                  size={20}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              ) : (
                <IconMoon
                  key="moon"
                  size={20}
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </AnimatePresence>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-14 pb-20 lg:pt-0 lg:pb-8 lg:pl-64">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile/Tablet Bottom Nav - hidden on desktop */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex flex-col items-center gap-0.5 py-1 px-1.5 min-w-0 text-xs transition-colors ${
                  active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <div className="relative">
                  <item.icon size={20} />
                  {item.label === 'Notifications' && unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1.5 flex items-center justify-center w-3.5 h-3.5 text-[8px] font-bold rounded-full bg-destructive text-white"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                  {item.label === 'Live' && liveCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1.5 flex items-center justify-center w-3.5 h-3.5 text-[8px] font-bold rounded-full bg-red-500 text-white"
                    >
                      {liveCount > 9 ? '9+' : liveCount}
                    </motion.span>
                  )}
                </div>
                <span className="text-[9px] leading-tight truncate max-w-[48px]">
                  {item.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute -bottom-1 left-1 right-1 h-0.5 rounded-full bg-foreground"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
