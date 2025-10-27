import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Building2 } from "lucide-react";
import { toast } from "sonner";

interface LayoutProps {
  children: ReactNode;
  title: string;
  role?: string;
}

const Layout = ({ children, title, role }: LayoutProps) => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setUserName(profile.full_name);
        }
      }
    };

    fetchUserProfile();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      // Ignore session_not_found errors - session is already gone
      if (error && error.message && !error.message.toLowerCase().includes("session")) {
        toast.error("Error logging out");
        return;
      }
      // Clear local storage manually to ensure clean logout
      localStorage.removeItem('supabase.auth.token');
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      // Even if there's an error, clear local state and redirect
      localStorage.removeItem('supabase.auth.token');
      toast.success("Logged out successfully");
      navigate("/auth");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{title}</h1>
              {userName && (
                <p className="text-xs text-muted-foreground">{userName}</p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>
      <main className="flex-1 container py-8 px-4 pb-24">{children}</main>
      <footer className="fixed bottom-0 left-0 right-0 z-40 w-full border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container py-3 px-4">
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Motherson Sumi Wiring India Ltd
            </p>
            <p className="text-xs text-muted-foreground">
              Employee Onboarding & Evaluation System
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;