import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import AdminDashboard from "./pages/AdminDashboard";
import EvaluatorDashboard from "./pages/EvaluatorDashboard";
import EvaluatePage from "./pages/EvaluatePage";
import ManagerDashboard from "./pages/ManagerDashboard";
import ManagerReviewPage from "./pages/ManagerReviewPage";
import NewJoineeDashboard from "./pages/NewJoineeDashboard";
import TestManagement from "./pages/TestManagement";
import TestPage from "./pages/TestPage";
import ReportCard from "./pages/ReportCard";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();
const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const fetchUserRole = async (userId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
      if (error) {
        console.error("Error fetching role:", error);
        setUserRole(null);
      } else {
        setUserRole(data?.role || null);
      }
    } catch (error) {
      console.error("Error:", error);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };
  const getDashboardRoute = () => {
    if (!userRole) return "/auth";
    switch (userRole) {
      case "admin":
        return "/admin";
      case "evaluator":
        return "/evaluator";
      case "manager":
        return "/manager";
      case "new_joinee":
        return "/dashboard";
      default:
        return "/auth";
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>;
  }
  return <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={session ? <Navigate to={getDashboardRoute()} replace /> : <Navigate to="/auth" replace />} />
            <Route path="/auth" element={!session ? <Auth /> : <Navigate to={getDashboardRoute()} replace />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/admin" element={session && userRole === "admin" ? <AdminDashboard /> : <Navigate to="/auth" replace />} />
            <Route path="/admin/tests" element={session && userRole === "admin" ? <TestManagement /> : <Navigate to="/auth" replace />} />
            <Route path="/evaluator" element={session && userRole === "evaluator" ? <EvaluatorDashboard /> : <Navigate to="/auth" replace />} />
          <Route path="/evaluate/:attemptId" element={session && (userRole === "evaluator" || userRole === "manager") ? <EvaluatePage /> : <Navigate to="/auth" replace />} />
          <Route path="/manager-review/:attemptId" element={session && userRole === "manager" ? <ManagerReviewPage /> : <Navigate to="/auth" replace />} />
            <Route path="/manager" element={session && userRole === "manager" ? <ManagerDashboard /> : <Navigate to="/auth" replace />} />
            <Route path="/dashboard" element={session && userRole === "new_joinee" ? <NewJoineeDashboard /> : <Navigate to="/auth" replace />} />
            <Route path="/test/:testId" element={session && userRole === "new_joinee" ? <TestPage /> : <Navigate to="/auth" replace />} />
            <Route path="/report-card" element={session && (userRole === "evaluator" || userRole === "manager" || userRole === "admin") ? <ReportCard /> : <Navigate to="/auth" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>;
};
export default App;