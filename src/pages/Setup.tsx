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

      toast.success("Test users created successfully!");
      console.log("Created users:", data.results);
    } catch (error) {
      console.error('Setup error:', error);
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
              <li>Email: admin1@company.local</li>
              <li>Password: Pass@123</li>
              <li>Role: Admin</li>
            </ul>
          </div>
          <Button onClick={setupUsers} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              "Create Test Users"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Setup;
