import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { getCurrentUser, onAuthStateChange } from '@/lib/supabase/auth';
import { getProfile } from '@/lib/supabase/profiles';

/**
 * ProtectedRoute component - Wraps protected guild routes with authentication
 * @param {ReactNode} children - Child components to render if authenticated
 */

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('ProtectedRoute mounted - checking auth...');
    checkAuth();

    // Listen to auth state changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      console.log('ProtectedRoute - Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user) {
        const { success, data: userProfile } = await getProfile(session.user.id);
        console.log('ProtectedRoute - Profile check result:', success, userProfile);
        
        if (success && userProfile && userProfile.is_active) {
          setAuthenticated(true);
        } else {
          navigate('/');
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthenticated(false);
        navigate('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const checkAuth = async () => {
    try {
      console.log('ProtectedRoute - Checking current user...');
      const { success: userSuccess, user: currentUser } = await getCurrentUser();
      console.log('ProtectedRoute - Current user check result:', userSuccess, currentUser?.id);
      
      if (userSuccess && currentUser) {
        // Get user profile
        const { success: profileSuccess, data: userProfile } = await getProfile(currentUser.id);
        console.log('ProtectedRoute - Profile check result:', profileSuccess, userProfile);
        
        if (profileSuccess && userProfile) {
          // Check if user is active
          if (userProfile.is_active) {
            setAuthenticated(true);
          } else {
            console.log('ProtectedRoute - User is not active');
            navigate('/');
          }
        } else {
          console.log('ProtectedRoute - Profile check failed');
          navigate('/');
        }
      } else {
        console.log('ProtectedRoute - User not authenticated');
        navigate('/');
      }
    } catch (error) {
      console.error('ProtectedRoute - Auth check error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  // User is authenticated, render children
  return <>{children}</>;
};

export default ProtectedRoute;
