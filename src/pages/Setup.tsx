import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Setup = () => {
  const [loading, setLoading] = useState(false);

  const setupUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-test-users');
      
      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Display the temporary password in a secure way
      if (data.results && data.results.length > 0 && data.results[0].temporaryPassword) {
        const tempPassword = data.results[0].temporaryPassword;
        toast.success("Admin user created successfully!", {
          duration: 10000,
          description: `Temporary Password: ${tempPassword} - Please save this and change it on first login.`
        });
      } else {
        toast.success("User setup completed!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to setup users");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Initial Setup</CardTitle>
          <CardDescription>
            Create test users for the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <p className="font-medium">This will create an admin user:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>User ID: MSWIL_001</li>
              <li>A secure temporary password will be generated</li>
              <li>Role: Admin</li>
            </ul>
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
              <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                ⚠️ Security Notice: You will be required to change the password on first login.
              </p>
            </div>
          </div>
          <Button onClick={setupUsers} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              "Create Admin User"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Setup;
