import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, User } from "lucide-react";
import { z } from "zod";
import mothersonLogo from "@/assets/motherson-logo.png";

const loginSchema = z.object({
  userId: z.string().trim().min(3, { message: "User ID must be at least 3 characters" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" })
});

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    userId: "",
    password: ""
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = loginSchema.parse(formData);
      setIsLoading(true);

      // Convert UserID to email format for Supabase auth
      const email = `${validated.userId}@company.local`;

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid User ID or password");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Logged in successfully");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto">
            <img src={mothersonLogo} alt="Motherson Sumi" className="h-16 w-auto mx-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">Assessment Portal</CardTitle>
          <CardDescription className="text-base">Motherson Sumi Wiring India Ltd<br/>Employee Onboarding & Evaluation System</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID (e.g., MSWIL_001)</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="userId"
                  type="text"
                  placeholder="Enter your User ID"
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;