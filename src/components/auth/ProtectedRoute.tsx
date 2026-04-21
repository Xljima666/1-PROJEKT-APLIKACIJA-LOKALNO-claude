import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type PermissionKey =
  | "poslovi"
  | "geodezija"
  | "firma"
  | "tim"
  | "postavke"
  | "kontakt_upiti"
  | "kontakt-upiti" // legacy
  | "privatne_biljeske"
  | "sve_privatne_biljeske"
  | "stellan_only";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: PermissionKey;
}

// Normaliziraj ključ (App.tsx koristi "kontakt-upiti", baza "kontakt_upiti")
const normalizeKey = (k?: string) => (k ? k.replace(/-/g, "_") : undefined);

const legacyKey = (key: string) => {
  const map: Record<string, string> = {
    kontakt_upiti: "kontakt-upiti",
    privatne_biljeske: "privatne-biljeske",
    sve_privatne_biljeske: "privatne-biljeske-sve",
    stellan_only: "samo-stellan",
  };
  return map[key] ?? key;
};

const permissionVariants = (requiredPermission: PermissionKey) => {
  const normalized = normalizeKey(requiredPermission)!;
  return Array.from(new Set([requiredPermission, normalized, legacyKey(normalized)]));
};

const ProtectedRoute = ({ children, requiredPermission }: ProtectedRouteProps) => {
  const { user, isLoading: authLoading } = useAuth();
  const location = useLocation();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!user) {
        setChecking(false);
        setAllowed(false);
        return;
      }

      // Bez traženog dopuštenja — svaki ulogiran user prolazi
      if (!requiredPermission) {
        if (!cancelled) {
          setAllowed(true);
          setChecking(false);
        }
        return;
      }

      const key = normalizeKey(requiredPermission)!;
      const keys = permissionVariants(requiredPermission);

      // 1) Admin uvijek prolazi
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleRow?.role === "admin") {
        if (!cancelled) {
          setAllowed(true);
          setChecking(false);
        }
        return;
      }

      // 2) Za običnog korisnika — provjeri tab_permissions
      const { data: permRow } = await supabase
        .from("tab_permissions")
        .select("enabled")
        .eq("user_id", user.id)
        .eq("tab_key", key)
        .maybeSingle();

      if (permRow?.enabled) {
        if (!cancelled) {
          setAllowed(true);
          setChecking(false);
        }
        return;
      }

      const { data: legacyRows } = await supabase
        .from("user_tab_permissions")
        .select("tab_key")
        .eq("user_id", user.id)
        .in("tab_key", keys)
        .limit(1);

      if (!cancelled) {
        setAllowed((legacyRows?.length ?? 0) > 0);
        setChecking(false);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [user, requiredPermission]);

  if (authLoading || checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !allowed) {
    // Preusmjeri na dashboard s porukom umjesto 404
    return <Navigate to="/dashboard?denied=1" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
