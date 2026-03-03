import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard       from './pages/Dashboard';
import Orders          from './pages/Orders';
import OrderDetail     from './pages/OrderDetail';
import NewOrder        from './pages/NewOrder';
import Cadastros       from './pages/Cadastros';
import ProductAnalysis from './pages/ProductAnalysis';
import Login           from './pages/Login';
import ChangePassword  from './pages/ChangePassword';

const navBase = [
  { to: '/',           label: 'Dashboard'  },
  { to: '/analysis',   label: 'Por Etapa'  },
  { to: '/orders',     label: 'Ordens'     },
  { to: '/orders/new', label: 'Nova Ordem' },
];

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AppShell() {
  const { token, user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const nav = isAdmin ? [...navBase, { to: '/cadastros', label: 'Cadastros' }] : navBase;

  if (!token) {
    return (
      <Routes>
        <Route path="/login"           element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="*"                element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <span className="font-bold text-lg tracking-wide shrink-0">Dados Operacionais</span>
          <nav className="flex flex-wrap gap-1 text-sm flex-1">
            {nav.map(n => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  isActive
                    ? 'bg-brand-900 px-3 py-1 rounded font-semibold whitespace-nowrap'
                    : 'hover:bg-brand-600 px-3 py-1 rounded whitespace-nowrap'
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm shrink-0">
            <span className="text-brand-200 text-xs hidden sm:inline">{user?.name}</span>
            <button onClick={logout}
              className="hover:bg-brand-600 px-3 py-1 rounded text-xs">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6">
        <Routes>
          <Route path="/"                element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/analysis"        element={<ProtectedRoute><ProductAnalysis /></ProtectedRoute>} />
          <Route path="/orders"          element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/orders/new"      element={<ProtectedRoute><NewOrder /></ProtectedRoute>} />
          <Route path="/orders/:id"      element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
          <Route path="/cadastros"       element={<AdminRoute><Cadastros /></AdminRoute>} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="*"                element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
