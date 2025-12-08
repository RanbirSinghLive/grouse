import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useHouseholdStore } from './store/useHouseholdStore';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { Budget } from './pages/Budget';
import { Projections } from './pages/Projections';
import { Settings } from './pages/Settings';

const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-1">
            <h1 className="text-xl font-bold text-gray-900">Grouse</h1>
            <span className="text-xs text-gray-500 ml-2">Personal Finance</span>
          </div>
          <div className="flex gap-1">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname === '/'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/accounts"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname === '/accounts'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Accounts
            </Link>
            <Link
              to="/budget"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname === '/budget'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Budget
            </Link>
            <Link
              to="/projections"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname === '/projections'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Projections
            </Link>
            <Link
              to="/settings"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname === '/settings'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Settings
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

function App() {
  const initialize = useHouseholdStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="container mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/projections" element={<Projections />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;

