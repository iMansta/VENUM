import { useEffect, useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { getCurrentUser } from '../../../lib/supabase/auth';
import { getProfile } from '../../../lib/supabase/profiles';
import GuildAuth from './GuildAuth';

/**
 * ProtectedRoute component - Wraps protected guild routes with authentication
 * @param {ReactNode} children - Child components to render if authenticated
 */

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { success: userSuccess, user: currentUser } = await getCurrentUser();
      
      if (userSuccess && currentUser) {
        setUser(currentUser);
        
        // Get user profile
        const { success: profileSuccess, data: userProfile } = await getProfile(currentUser.id);
        
        if (profileSuccess && userProfile) {
          // Check if user is active
          if (userProfile.is_active) {
            setProfile(userProfile);
            setAuthenticated(true);
          } else {
            console.warn('User account is inactive');
          }
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (authData) => {
    setAuthenticated(true);
    setUser(authData.user);
    // Profile will be loaded on next render
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <GuildAuth onAuthSuccess={handleAuthSuccess} />;
  }

  // User is authenticated, render children
  return <>{children}</>;
};

export default ProtectedRoute;
