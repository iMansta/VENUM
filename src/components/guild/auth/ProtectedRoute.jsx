import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { getCurrentUser } from '@/lib/supabase/auth';
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
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { success: userSuccess, user: currentUser } = await getCurrentUser();
      
      if (userSuccess && currentUser) {
        // Get user profile
        const { success: profileSuccess, data: userProfile } = await getProfile(currentUser.id);
        
        if (profileSuccess && userProfile) {
          // Check if user is active
          if (userProfile.is_active) {
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
      console.error('Auth check error:', error);
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
