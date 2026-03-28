import { Toaster } from "@/components/ui/toaster";
import { UpdateBanner } from "@/components/UpdateBanner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ImpersonationProvider } from "@/hooks/useImpersonation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import KanbanBoards from "./pages/KanbanBoards";
import KanbanRows from "./pages/KanbanRows";
import Calendar from "./pages/Calendar";
import Invoices from "./pages/Invoices";
import Firma from "./pages/Firma";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import ContactSubmissions from "./pages/ContactSubmissions";
import NotFound from "./pages/NotFound";
import TokenUsage from "./pages/TokenUsage";
import Software from "./pages/Software";
import Stellan from "./pages/Stellan";
import AuthCallback from "./pages/AuthCallback";

const queryClient = new QueryClient();

// Build trigger v2
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <UpdateBanner />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
        <ImpersonationProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/software" element={<Software />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kanban"
              element={
                <ProtectedRoute requiredPermission="poslovi">
                  <KanbanBoards />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kanban-rows"
              element={
                <ProtectedRoute requiredPermission="poslovi">
                  <KanbanRows />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute requiredPermission="geodezija">
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/firma"
              element={
                <ProtectedRoute requiredPermission="firma">
                  <Firma />
                </ProtectedRoute>
              }
            />
            <Route
              path="/team"
              element={
                <ProtectedRoute requiredPermission="tim">
                  <Team />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requiredPermission="postavke">
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contact-submissions"
              element={
                <ProtectedRoute requiredPermission="kontakt-upiti">
                  <ContactSubmissions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/token-usage"
              element={
                <ProtectedRoute>
                  <TokenUsage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stellan"
              element={
                <ProtectedRoute>
                  <Stellan />
                </ProtectedRoute>
              }
            />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ImpersonationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
