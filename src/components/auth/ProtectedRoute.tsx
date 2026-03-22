import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requiredPermission?: string;
}

const ProtectedRoute = ({ children, requireAdmin = false, requiredPermission }: ProtectedRouteProps) => {
  const { user, isLoading, isAdmin } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const location = useLocation();
  const [permChecked, setPermChecked] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!requiredPermission) {
      setHasPermission(true);
      setPermChecked(true);
      return;
    }

    // When impersonating, check the impersonated user's permissions
    if (isImpersonating && impersonatedUser && isAdmin) {
      const check = async () => {
        const { data } = await supabase
          .from("user_tab_permissions")
          .select("id")
          .eq("user_id", impersonatedUser.id)
          .eq("tab_key", requiredPermission)
          .maybeSingle();
        setHasPermission(!!data);
        setPermChecked(true);
      };
      check();
      return;
    }

    // Admin always has access
    if (isAdmin) {
      setHasPermission(true);
      setPermChecked(true);
      return;
    }

    if (!user) {
      setPermChecked(true);
      return;
    }

    // Non-admin: check DB permission
    const check = async () => {
      const { data } = await supabase
        .from("user_tab_permissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("tab_key", requiredPermission)
        .maybeSingle();
      setHasPermission(!!data);
      setPermChecked(true);
    };
    check();
  }, [user, isAdmin, isLoading, requiredPermission, isImpersonating, impersonatedUser]);

  if (isLoading || !permChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Učitavanje...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/stellan" replace />;
  }

  if (requiredPermission && !hasPermission) {
    return <Navigate to="/stellan" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
