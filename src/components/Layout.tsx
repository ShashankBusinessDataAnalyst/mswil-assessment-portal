import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, FileText } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/motherson-logo.png";
interface LayoutProps {
  children: ReactNode;
  title: string;
  role?: string;
}
const Layout = ({
  children,
  title,
  role
}: LayoutProps) => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");
  useEffect(() => {
    const fetchUserProfile = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (user) {
        const {
          data: profile
        } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
        if (profile) {
          setUserName(profile.full_name);
        }
      }
    };
    fetchUserProfile();
  }, []);
  const handleGoHome = () => {
    switch (role) {
      case "admin":
        navigate("/admin");
        break;
      case "manager":
        navigate("/manager");
        break;
      case "evaluator":
        navigate("/evaluator");
        break;
      case "new_joinee":
        navigate("/new-joinee");
        break;
      default:
        navigate("/");
        break;
    }
  };
  const handleLogout = async () => {
    try {
      const {
        error
      } = await supabase.auth.signOut();
      if (error && error.message && !error.message.toLowerCase().includes("session")) {
        toast.error("Error logging out");
        return;
      }
      localStorage.removeItem('supabase.auth.token');
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      localStorage.removeItem('supabase.auth.token');
      toast.success("Logged out successfully");
      navigate("/auth");
    }
  };
  return <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-primary-foreground">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Left - Clickable Logo */}
          <button onClick={handleGoHome} className="flex-shrink-0">
            <img src={logo} alt="Motherson Logo" className="w-12 h-12 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity border-2 border-muted-foreground" />
          </button>
          
          {/* Center-Left - Title Section */}
          <div className="flex items-center gap-3 bg-white/90 px-4 py-2 rounded-lg ml-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-400 to-rose-500 flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
              {userName && <p className="text-xs text-gray-500">{userName}</p>}
            </div>
          </div>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Right - Logout Button */}
          <Button variant="outline" size="sm" onClick={handleLogout} className="bg-white hover:bg-gray-100">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>
      <main className="flex-1 container py-8 px-4 pb-24 border-gray-800">{children}</main>
      <footer className="fixed bottom-0 left-0 right-0 z-40 w-full border-t backdrop-blur bg-[#ffd5d5]/95 shadow-sm">
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
    </div>;
};
export default Layout;