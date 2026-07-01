import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LandingPage from '@/components/landing/LandingPage';
import RegisterPage from '@/components/landing/RegisterPage';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProtectedRoute from '@/components/guild/auth/ProtectedRoute';
import Dashboard from '@/pages/Dashboard';
import Ranking from '@/pages/Ranking';
import Missions from '@/pages/Missions';
import Market from '@/pages/Market';
import Builds from '@/pages/Builds';
import Production from '@/pages/Production';
import AdminPanel from '@/components/guild/admin/AdminPanel';
import { getSession, onAuthStateChange } from '@/lib/supabase/auth';
import { getProfile } from '@/lib/supabase/profiles';

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('App mounted - checking auth...');
    checkAuth();

    // Listen to auth state changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const { success, data: userProfile } = await getProfile(session.user.id);
        if (success) {
          setProfile(userProfile);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    try {
      console.log('Checking session...');
      const { success, session } = await getSession();
      console.log('Session check result:', success, session?.user?.id);

      if (success && session?.user) {
        setUser(session.user);
        const { success: profileSuccess, data: userProfile } = await getProfile(session.user.id);
        console.log('Profile check result:', profileSuccess, userProfile);
        if (profileSuccess) {
          setProfile(userProfile);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout userId={user?.id} userRole={profile?.role} profile={profile} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard userId={user?.id} />} />
        </Route>
        <Route
          path="/ranking"
          element={
            <ProtectedRoute>
              <DashboardLayout userId={user?.id} userRole={profile?.role} profile={profile} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Ranking userId={user?.id} />} />
        </Route>
        <Route
          path="/missions"
          element={
            <ProtectedRoute>
              <DashboardLayout userId={user?.id} userRole={profile?.role} profile={profile} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Missions userId={user?.id} userRole={profile?.role} />} />
        </Route>
        <Route
          path="/market"
          element={
            <ProtectedRoute>
              <DashboardLayout userId={user?.id} userRole={profile?.role} profile={profile} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Market userId={user?.id} />} />
        </Route>
        <Route
          path="/production"
          element={
            <ProtectedRoute>
              <DashboardLayout userId={user?.id} userRole={profile?.role} profile={profile} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Production />} />
        </Route>
        <Route
          path="/builds"
          element={
            <ProtectedRoute>
              <DashboardLayout userId={user?.id} userRole={profile?.role} profile={profile} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Builds />} />
        </Route>
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <DashboardLayout userId={user?.id} userRole={profile?.role} profile={profile} />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminPanel userId={user?.id} userRole={profile?.role} />} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;