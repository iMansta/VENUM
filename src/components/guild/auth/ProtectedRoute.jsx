import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { getSession, onAuthStateChange } from '@/lib/supabase/auth';
import { getProfile } from '@/lib/supabase/profiles';

/**
 * ProtectedRoute component - Wraps protected guild routes with authentication
 * @param {ReactNode} children - Child components to render if authenticated
 * @param {string} requiredRole - Optional required role ('admin', 'officer', 'member')
 */

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [authorized, setAuthorized] = useState(true);
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
          // Check role if required
          if (requiredRole) {
            const hasRole = checkUserRole(userProfile.role, requiredRole);
            setAuthorized(hasRole);
            if (!hasRole) {
              navigate('/dashboard');
            }
          }
          setAuthenticated(true);
        } else {
          navigate('/');
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthenticated(false);
        setAuthorized(false);
        navigate('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, requiredRole]);

  const checkUserRole = (userRole, required) => {
    if (required === 'admin') {
      return userRole === 'admin';
    } else if (required === 'officer') {
      return userRole === 'admin' || userRole === 'officer';
    }
    return true;
  };

  const checkAuth = async () => {
    try {
      console.log('ProtectedRoute - Checking session...');
      const { success, session } = await getSession();
      console.log('ProtectedRoute - Session check result:', success, session?.user?.id);
      
      if (success && session?.user) {
        // Get user profile
        const { success: profileSuccess, data: userProfile } = await getProfile(session.user.id);
        console.log('ProtectedRoute - Profile check result:', profileSuccess, userProfile);
        
        if (profileSuccess && userProfile) {
          // Check if user is active
          if (userProfile.is_active) {
            // Check role if required
            if (requiredRole) {
              const hasRole = checkUserRole(userProfile.role, requiredRole);
              setAuthorized(hasRole);
              if (!hasRole) {
                console.log('ProtectedRoute - User does not have required role');
                navigate('/dashboard');
              }
            }
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

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-400">Acesso não autorizado</p>
        </div>
      </div>
    );
  }

  // User is authenticated and authorized, render children
  return <>{children}</>;
};

export default ProtectedRoute;
