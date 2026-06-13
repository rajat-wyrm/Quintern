import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import {
  Avatar,
  Badge,
  Button,
  CommandPalette,
  ConfirmDialog,
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  Modal,
  Skeleton,
  ToastHost,
  cx,
  toast,
} from './ui';
import { MobileNav } from './MobileNav';
import { ROLE_LABEL, isManager } from '../lib/constants';
import { useShortcuts } from '../lib/shortcuts';

// Inline brand mark for the sidebar
function Mark({ size = 'md' }) {
  const dim = size === 'lg' ? 'w-10 h-10' : 'w-9 h-9';
  return (
    <svg viewBox="0 0 40 40" className={dim} aria-hidden="true">
      <defs>
        <linearGradient id="us-sidebar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(99 102 241)" />
          <stop offset="100%" stopColor="rgb(139 92 246)" />
        </linearGradient>
      </defs>
      <rect
        x="0"
        y="0"
        width="40"
        height="40"
        rx="11"
        fill="url(#us-sidebar)"
      />
      <path d="M20 8 L30 28 L20 22 L10 28 Z" fill="white" />
    </svg>
  );
}

const ROLE_TONE = {
  ADMIN: 'danger',
  SENIOR_TL: 'info',
  TL: 'brand',
  CAPTAIN: 'success',
  INTERN: 'neutral',
};

const ICONS = {
  home: (
    <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9.5z" />
  ),
  calendar: (
    <>
      <path d="M8 2v3M16 2v3M3.5 9.09h17M21 8.5V17c0 3-1.5 5-5 5H8c-3.5 0-5-2-5-5V8.5c0-3 1.5-5 5-5h8c3.5 0 5 2 5 5z" />
    </>
  ),
  star: (
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  video: (
    <>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 3 3 5-5" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.09A1.65 1.65 0 003.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H8a1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H22a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  log: (
    <>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.5 5L19 10l-5.5 2L12 17l-1.5-5L5 10l5.5-2L12 3zM19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </>
  ),
  bellDot: (
    <>
      <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
      <circle cx="18" cy="5" r="3" fill="currentColor" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronRight: <path d="M9 18l6-6-6-6" />,
  board: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 7v10M15 7v6" />
    </>
  ),
  close: (
    <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.11.05 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
  ),
  menu: <path d="M3 12h18M3 6h18M3 18h18" />,
};

function Icon({ name, className = 'w-4 h-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const PRIMARY_NAV = [
  { path: '/', label: 'Dashboard', icon: 'home', shortcut: 'd' },
  { path: '/projects', label: 'Projects', icon: 'board', shortcut: 'p' },
  { path: '/attendance', label: 'Attendance', icon: 'calendar', shortcut: 'a' },
  { path: '/ratings', label: 'Ratings', icon: 'star', shortcut: 'r' },
  { path: '/tasks', label: 'Tasks', icon: 'target', shortcut: 't' },
  { path: '/meetings', label: 'Meetings', icon: 'video', shortcut: 'm' },
  { path: '/notifications', label: 'Inbox', icon: 'bell', shortcut: 'n' },
  {
    path: '/assistant',
    label: 'AI Assistant',
    icon: 'sparkles',
    shortcut: 'i',
  },
];
const TEAM_NAV = {
  path: '/team',
  label: 'My Team',
  icon: 'users',
  managerOnly: true,
  shortcut: 'e',
};
const ACCOUNT_NAV = [
  { path: '/profile', label: 'Profile', icon: 'user' },
  { path: '/sessions', label: 'Sessions', icon: 'shield' },
  { path: '/reports', label: 'Reports', icon: 'chart' },
];
const ADMIN_NAV = [
  { path: '/admin', label: 'User Management', icon: 'admin' },
  { path: '/departments', label: 'Departments', icon: 'building' },
  { path: '/analytics', label: 'Analytics', icon: 'chart' },
  { path: '/audit', label: 'Audit Log', icon: 'log' },
  { path: '/exports', label: 'Exports', icon: 'download' },
];

function NavItem({ item, active, collapsed, onClick, badge }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={({ isActive: navActive }) =>
        [
          'group relative flex items-center gap-3 rounded-md text-sm font-medium',
          'transition-colors duration-100',
          collapsed ? 'justify-center h-9 w-9 mx-auto' : 'px-2.5 h-9',
          active || navActive
            ? 'bg-surface-raised text-fg shadow-xs border border-border'
            : 'text-fg-muted hover:text-fg hover:bg-surface-sunken',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="truncate flex-1">{item.label}</span>}
          {!collapsed && badge != null && (
            <span className="ml-auto text-[10px] font-semibold rounded-md px-1.5 py-0.5 bg-fg text-fg-inverse min-w-[18px] text-center">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-fg rounded-r-full" />
          )}
        </>
      )}
    </NavLink>
  );
}

function NavSectionLabel({ title, collapsed }) {
  if (collapsed) return <div className="my-1 mx-3 border-t border-border" />;
  return (
    <div className="mt-5 mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
      {title}
    </div>
  );
}

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const role = user?.role;
  const isAdmin = role === 'ADMIN';
  const manager = isManager(role);

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar') === 'collapsed'
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem('theme') === 'dark'
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    localStorage.setItem('sidebar', collapsed ? 'collapsed' : 'open');
  }, [collapsed]);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Live profile (so display name + avatar update everywhere instantly)
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['myProfile'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    staleTime: 60_000,
  });
  const displayName = me?.full_name || user?.fullName || user?.email;
  const avatarUrl = me?.avatar_url || null;
  const initials = useMemo(() => {
    const s = String(displayName || '');
    return (
      s
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('') || '?'
    );
  }, [displayName]);

  // Unread notification count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () =>
      api
        .get('/notifications/unread-count')
        .then((r) => r.data)
        .catch(() => ({ unread: 0 })),
    refetchInterval: 30000,
  });
  const unread = unreadData?.unread || 0;

  const nav = useMemo(
    () =>
      PRIMARY_NAV.map((n) =>
        n.path === '/notifications' ? { ...n, badge: unread || null } : n
      ),
    [unread]
  );
  const allItems = useMemo(
    () => [
      ...nav,
      ...(manager ? [TEAM_NAV] : []),
      ...ACCOUNT_NAV,
      ...(isAdmin ? ADMIN_NAV : []),
    ],
    [nav, manager, isAdmin]
  );
  const current = allItems.find((n) => n.path === location.pathname);
  const computedTitle = current?.label || 'Dashboard';

  // Build palette items
  const paletteItems = useMemo(() => {
    const items = allItems.map((n) => ({
      label: n.label,
      icon: <Icon name={n.icon} className="w-4 h-4" />,
      onSelect: () => navigate(n.path),
      hint: n.path,
    }));
    items.push({
      label: 'Toggle theme',
      icon: <Icon name={dark ? 'sun' : 'moon'} className="w-4 h-4" />,
      onSelect: () => setDark((d) => !d),
      hint: 'theme',
    });
    items.push({
      label: 'Sign out',
      icon: <Icon name="logout" className="w-4 h-4" />,
      onSelect: () => setConfirmLogout(true),
      hint: 'logout',
    });
    items.push({
      label: 'AI Assistant',
      icon: <Icon name="sparkles" className="w-4 h-4" />,
      onSelect: () => navigate('/assistant'),
      hint: '/assistant',
    });
    return items;
  }, [allItems, navigate, dark]);

  // ⌘K palette
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target;
        if (
          t?.tagName === 'INPUT' ||
          t?.tagName === 'TEXTAREA' ||
          t?.isContentEditable
        )
          return;
        e.preventDefault();
        setShowShortcuts(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const shortcuts = useMemo(() => {
    const seq = allItems
      .filter((n) => n.shortcut)
      .map((n) => ({
        combo: 'g ' + n.shortcut,
        scope: 'global',
        action: () => navigate(n.path),
      }));
    return [
      ...seq,
      { combo: 'mod+k', scope: 'global', action: () => setPaletteOpen(true) },
      { combo: '?', scope: 'global', action: () => setShowShortcuts(true) },
    ];
  }, [allItems, navigate]);
  useShortcuts({ shortcuts, activeScopes: ['global'] });

  const handleLogout = useCallback(() => {
    logout();
    toast({
      kind: 'success',
      title: 'Signed out',
      description: 'See you soon.',
    });
    setTimeout(() => navigate('/login', { replace: true }), 50);
  }, [logout, navigate]);

  const SidebarBody = ({ onItemClick }) => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-3 py-4 flex items-center gap-2.5 border-b border-border">
        <div className="shrink-0">
          <Mark size="lg" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-fg truncate leading-tight">
              Quintern
            </div>
            <div className="text-[10px] text-fg-muted truncate">
              Workforce operations
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        <NavSectionLabel title="Workspace" collapsed={collapsed} />
        <div className="space-y-0.5">
          {PRIMARY_NAV.map((n) => {
            const item =
              n.path === '/notifications' ? { ...n, badge: unread || null } : n;
            return (
              <NavItem
                key={n.path}
                item={item}
                active={location.pathname === n.path}
                collapsed={collapsed}
                onClick={onItemClick}
              />
            );
          })}
          {manager && (
            <NavItem
              item={TEAM_NAV}
              active={location.pathname === TEAM_NAV.path}
              collapsed={collapsed}
              onClick={onItemClick}
            />
          )}
        </div>
        <NavSectionLabel title="Account" collapsed={collapsed} />
        <div className="space-y-0.5">
          {ACCOUNT_NAV.map((n) => (
            <NavItem
              key={n.path}
              item={n}
              active={location.pathname === n.path}
              collapsed={collapsed}
              onClick={onItemClick}
            />
          ))}
        </div>
        {isAdmin && (
          <>
            <NavSectionLabel title="Admin" collapsed={collapsed} />
            <div className="space-y-0.5">
              {ADMIN_NAV.map((n) => (
                <NavItem
                  key={n.path}
                  item={n}
                  active={location.pathname === n.path}
                  collapsed={collapsed}
                  onClick={onItemClick}
                />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* User card with prominent sign out */}
      <div className="px-3 py-3 border-t border-border">
        <Dropdown
          align={collapsed ? 'right' : 'right'}
          menuClassName="w-60"
          trigger={
            <button
              className={cx(
                'w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-sunken transition-colors',
                collapsed && 'justify-center'
              )}
              aria-label="Account menu"
            >
              {meLoading ? (
                <Skeleton className="w-8 h-8 rounded-full" />
              ) : (
                <Avatar
                  name={displayName}
                  email={user?.email}
                  src={avatarUrl}
                  size="sm"
                  status="online"
                />
              )}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-fg truncate">
                    {displayName || 'Loading…'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge tone={ROLE_TONE[role]} size="xs" dot>
                      {ROLE_LABEL[role] || role}
                    </Badge>
                  </div>
                </div>
              )}
              {!collapsed && (
                <Icon
                  name="chevronRight"
                  className="w-3 h-3 text-fg-muted rotate-90"
                />
              )}
            </button>
          }
        >
          {({ close }) => (
            <>
              <div className="px-3 py-2.5 border-b border-border mb-1">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    name={displayName}
                    email={user?.email}
                    src={avatarUrl}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-fg truncate">
                      {displayName || '—'}
                    </div>
                    <div className="text-[11px] text-fg-muted truncate">
                      {user?.email}
                    </div>
                  </div>
                </div>
              </div>
              <DropdownLabel>Workspace</DropdownLabel>
              <DropdownItem
                icon={<Icon name="user" />}
                onClick={() => {
                  navigate('/profile');
                  close();
                }}
              >
                Your profile
              </DropdownItem>
              <DropdownItem
                icon={<Icon name="shield" />}
                onClick={() => {
                  navigate('/sessions');
                  close();
                }}
              >
                Active sessions
              </DropdownItem>
              <DropdownItem
                icon={<Icon name="sparkles" />}
                onClick={() => {
                  navigate('/assistant');
                  close();
                }}
              >
                AI Assistant
              </DropdownItem>
              <DropdownSeparator />
              <DropdownLabel>Preferences</DropdownLabel>
              <DropdownItem
                icon={<Icon name={dark ? 'sun' : 'moon'} />}
                onClick={() => {
                  setDark((d) => !d);
                  close();
                }}
              >
                {dark ? 'Light mode' : 'Dark mode'}
              </DropdownItem>
              <DropdownItem
                icon={<Icon name="search" />}
                onClick={() => {
                  setPaletteOpen(true);
                  close();
                }}
              >
                <span className="flex items-center justify-between w-full">
                  Search{' '}
                  <kbd className="text-[10px] font-mono ml-2 px-1.5 py-0.5 rounded bg-surface-sunken border border-border">
                    ⌘K
                  </kbd>
                </span>
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem
                icon={<Icon name="logout" />}
                danger
                onClick={() => {
                  setConfirmLogout(true);
                  close();
                }}
              >
                Sign out
              </DropdownItem>
            </>
          )}
        </Dropdown>
        {!collapsed && (
          <button
            onClick={() => setConfirmLogout(true)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium text-fg-muted hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
            title="Sign out of this account"
          >
            <Icon name="logout" className="w-3.5 h-3.5" />
            Sign out
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-surface-base text-fg overflow-hidden">
      {/* Skip link for a11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-fg focus:text-fg-inverse focus:px-3 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cx(
          'hidden lg:flex shrink-0 border-r border-border bg-surface-raised transition-[width] duration-200 ease-out',
          collapsed ? 'w-[68px]' : 'w-64'
        )}
        aria-label="Primary navigation"
      >
        <SidebarBody />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-surface-overlay/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="relative w-72 max-w-[85vw] bg-surface-raised border-r border-border animate-slide-in-right"
            aria-label="Primary navigation"
          >
            <SidebarBody onItemClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b border-border bg-surface-raised/80 backdrop-blur-md flex items-center gap-2 px-3 sm:px-5 sticky top-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-1.5 -ml-1.5 rounded hover:bg-surface-sunken text-fg-muted"
            aria-label="Open menu"
          >
            <Icon name="menu" className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex p-1.5 -ml-1.5 rounded hover:bg-surface-sunken text-fg-muted"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar"
          >
            <Icon
              name={collapsed ? 'chevronRight' : 'chevronLeft'}
              className="w-4 h-4"
            />
          </button>

          <h1 className="text-sm font-semibold text-fg truncate ml-1">
            {computedTitle}
          </h1>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 h-9 px-2.5 rounded-md border border-border bg-surface-base text-sm text-fg-muted hover:bg-surface-sunken hover:text-fg transition-colors"
              aria-label="Open command palette"
            >
              <Icon name="search" className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Search…</span>
              <kbd className="text-[10px] font-mono bg-surface-sunken px-1.5 py-0.5 rounded border border-border text-fg-muted">
                ⌘K
              </kbd>
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="sm:hidden p-2 rounded-md hover:bg-surface-sunken text-fg-muted hover:text-fg"
              aria-label="Search"
            >
              <Icon name="search" className="w-4 h-4" />
            </button>

            <button
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded-md hover:bg-surface-sunken text-fg-muted hover:text-fg transition-colors"
              title={dark ? 'Light mode' : 'Dark mode'}
              aria-label="Toggle theme"
            >
              <Icon name={dark ? 'sun' : 'moon'} className="w-4 h-4" />
            </button>

            <Link
              to="/notifications"
              className="relative p-2 rounded-md hover:bg-surface-sunken text-fg-muted hover:text-fg transition-colors"
              aria-label={`Notifications (${unread} unread)`}
            >
              <Icon
                name={unread > 0 ? 'bellDot' : 'bell'}
                className="w-4 h-4"
              />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>

            <Link
              to="/assistant"
              className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white text-xs font-semibold shadow-sm shadow-brand-500/20 hover:shadow-md hover:shadow-brand-500/30 transition-all"
            >
              <Icon name="sparkles" className="w-3.5 h-3.5" />
              <span>Ask AI</span>
            </Link>

            {/* Always-visible account avatar (works on every breakpoint) */}
            <Dropdown
              align="right"
              menuClassName="w-60"
              trigger={
                <button
                  className="p-0.5 rounded-full"
                  aria-label="Account menu"
                >
                  <Avatar
                    name={displayName}
                    email={user?.email}
                    src={avatarUrl}
                    size="sm"
                    status="online"
                  />
                </button>
              }
            >
              {({ close }) => (
                <>
                  <div className="px-3 py-2.5 border-b border-border mb-1">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        name={displayName}
                        email={user?.email}
                        src={avatarUrl}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-fg truncate">
                          {displayName || '—'}
                        </div>
                        <div className="text-[11px] text-fg-muted truncate">
                          {user?.email}
                        </div>
                      </div>
                    </div>
                  </div>
                  <DropdownItem
                    icon={<Icon name="user" />}
                    onClick={() => {
                      navigate('/profile');
                      close();
                    }}
                  >
                    Your profile
                  </DropdownItem>
                  <DropdownItem
                    icon={<Icon name="shield" />}
                    onClick={() => {
                      navigate('/sessions');
                      close();
                    }}
                  >
                    Active sessions
                  </DropdownItem>
                  <DropdownItem
                    icon={<Icon name="sparkles" />}
                    onClick={() => {
                      navigate('/assistant');
                      close();
                    }}
                  >
                    AI Assistant
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem
                    icon={<Icon name={dark ? 'sun' : 'moon'} />}
                    onClick={() => {
                      setDark((d) => !d);
                      close();
                    }}
                  >
                    {dark ? 'Light mode' : 'Dark mode'}
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem
                    icon={<Icon name="logout" />}
                    danger
                    onClick={() => {
                      setConfirmLogout(true);
                      close();
                    }}
                  >
                    Sign out
                  </DropdownItem>
                </>
              )}
            </Dropdown>
          </div>
        </header>

        <main
          id="main-content"
          key={location.pathname}
          className="flex-1 overflow-y-auto bg-surface-base"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-6 page-enter">
            {children}
          </div>
        </main>
      </div>

      <MobileNav isManager={manager} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
      />
      <ToastHost />

      <Modal
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        title="Keyboard shortcuts"
        size="md"
      >
        <div className="space-y-1 max-h-[60vh] overflow-y-auto -mx-1 px-1">
          <ShortcutRow keys={['⌘', 'K']} description="Open command palette" />
          <ShortcutRow keys={['?']} description="Show this dialog" />
          <div className="border-t border-border my-2" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted px-2 py-1">
            Navigation
          </p>
          {allItems
            .filter((n) => n.shortcut)
            .map((n) => (
              <ShortcutRow
                key={n.path}
                keys={['G', n.shortcut.toUpperCase()]}
                description={`Go to ${n.label}`}
              />
            ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
        title="Sign out?"
        message="You'll need to sign in again to access your workspace."
        confirmLabel="Sign out"
        danger
      />
    </div>
  );
}

function ShortcutRow({ keys, description }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-sunken/50 transition-colors">
      <span className="text-sm text-fg">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="text-[11px] font-mono font-medium text-fg bg-surface-sunken border border-border rounded px-1.5 py-0.5 min-w-[20px] text-center"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}
