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
  const [isStellanOnly, setIsStellanOnly] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    // Admin always has full access
    if (isAdmin && !isImpersonating) {
      setHasPermission(true);
      setIsStellanOnly(false);
      setPermChecked(true);
      return;
    }

    const targetUserId = isImpersonating && impersonatedUser && isAdmin
      ? impersonatedUser.id
      : user?.id;

    if (!targetUserId) {
      setPermChecked(true);
      return;
    }

    const check = async () => {
      // Check "samo-stellan" flag
      const { data: stellanOnly } = await supabase
        .from("user_tab_permissions")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("tab_key", "samo-stellan")
        .maybeSingle();

      if (stellanOnly) {
        setIsStellanOnly(true);
        setHasPermission(false);
        setPermChecked(true);
        return;
      }

      setIsStellanOnly(false);

      if (!requiredPermission) {
        setHasPermission(true);
        setPermChecked(true);
        return;
      }

      // Check specific permission
      const { data } = await supabase
        .from("user_tab_permissions")
        .select("id")
        .eq("user_id", targetUserId)
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

  // If user is "samo-stellan" and not on /stellan, redirect there
  if (isStellanOnly && location.pathname !== "/stellan") {
    return <Navigate to="/stellan" replace />;
  }

  if (requiredPermission && !hasPermission) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
