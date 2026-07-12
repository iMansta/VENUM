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
    checkAuth();

    // Listen to auth state changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { success, data: userProfile } = await getProfile(session.user.id);

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
      // Admin e Staff acessam o painel administrativo.
      return userRole === 'admin' || userRole === 'staff';
    } else if (required === 'officer') {
      return userRole === 'admin' || userRole === 'staff' || userRole === 'officer';
    }
    return true;
  };

  const checkAuth = async () => {
    try {
      const { success, session } = await getSession();

      if (success && session?.user) {
        // Get user profile
        const { success: profileSuccess, data: userProfile } = await getProfile(session.user.id);

        if (profileSuccess && userProfile) {
          // Check if user is active
          if (userProfile.is_active) {
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
        } else {
          navigate('/');
        }
      } else {
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
