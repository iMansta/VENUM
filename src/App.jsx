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
import SettingsPage from '@/pages/Settings';
import { getCurrentUser, onAuthStateChange } from '@/lib/supabase/auth';
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
      console.log('Checking current user...');
      const { success, user: currentUser } = await getCurrentUser();
      console.log('Current user check result:', success, currentUser?.id);
      
      if (success && currentUser) {
        setUser(currentUser);
        const { success: profileSuccess, data: userProfile } = await getProfile(currentUser.id);
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
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
              <DashboardLayout userId={user?.id} userRole={profile?.role}>
                <Dashboard userId={user?.id} />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ranking"
          element={
            <ProtectedRoute>
              <DashboardLayout userId={user?.id} userRole={profile?.role}>
                <Ranking userId={user?.id} />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/missions"
          element={
            <ProtectedRoute>
              <DashboardLayout userId={user?.id} userRole={profile?.role}>
                <Missions userId={user?.id} userRole={profile?.role} />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/market"
          element={
            <ProtectedRoute>
              <DashboardLayout userId={user?.id} userRole={profile?.role}>
                <Market />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <DashboardLayout userId={user?.id} userRole={profile?.role}>
                <SettingsPage userId={user?.id} userRole={profile?.role} />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
