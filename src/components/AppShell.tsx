import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const collegeName = 'Rajiv Gandhi Memorial College of Education';
const collegePlace = 'Kathua, Jammu & Kashmir';

function Mark() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-800 text-sm font-bold text-white">
      RG
    </span>
  );
}

export function AppShell() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-3 pb-8 sm:px-6">
      <header className="sticky top-0 z-20 -mx-3 mb-4 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Mark />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-brand-900 sm:text-base">{collegeName}</p>
              <p className="truncate text-xs text-slate-500">{collegePlace}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile && (
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">{profile.name}</p>
                <p className="text-xs text-slate-500">
                  {profile.role === 'admin'
                    ? 'Administrator'
                    : `Teacher · ${profile.teacherId}`}
                </p>
              </div>
            )}
            <button type="button" className="btn-secondary" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
        {profile?.role === 'admin' && (
          <nav className="mt-3 flex flex-wrap gap-1 overflow-x-auto no-print">
            {[
              { to: '/admin/today', label: "Today's Attendance" },
              { to: '/admin/history', label: 'Attendance History' },
              { to: '/admin/teachers', label: 'Teachers' },
              { to: '/admin/settings', label: 'Settings' },
              { to: '/admin/audit', label: 'Audit Log' }
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-brand-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400 no-print">
        {collegeName} · Attendance System · Times shown in Indian Standard Time (Asia/Kolkata)
      </footer>
    </div>
  );
}
