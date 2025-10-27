import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClipboardCheck, User, Calendar, ArrowRight } from "lucide-react";

interface PendingAttempt {
  id: string;
  user_id: string;
  test_id: string;
  submitted_at: string;
  profiles: {
    full_name: string;
    employee_id: string;
  };
  tests: {
    title: string;
    test_number: number;
  };
}

const EvaluatorDashboard = () => {
  const navigate = useNavigate();
  const [pendingAttempts, setPendingAttempts] = useState<PendingAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingAttempts();
  }, []);

  const fetchPendingAttempts = async () => {
    try {
      // Fetch test attempts
      const { data: attempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select("id, user_id, test_id, submitted_at")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true });

      if (attemptsError) throw attemptsError;
      if (!attempts || attempts.length === 0) {
        setPendingAttempts([]);
        return;
      }

      // Get unique user IDs and test IDs
      const userIds = [...new Set(attempts.map(a => a.user_id))];
      const testIds = [...new Set(attempts.map(a => a.test_id))];

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, employee_id")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Fetch tests
      const { data: tests, error: testsError } = await supabase
        .from("tests")
        .select("id, title, test_number")
        .in("id", testIds);

      if (testsError) throw testsError;

      // Combine the data
      const combined = attempts.map(attempt => ({
        ...attempt,
        profiles: profiles?.find(p => p.id === attempt.user_id) || { full_name: "Unknown", employee_id: "N/A" },
        tests: tests?.find(t => t.id === attempt.test_id) || { title: "Unknown", test_number: 0 }
      }));

      setPendingAttempts(combined as any);
    } catch (error) {
      toast.error("Failed to load pending evaluations");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Evaluator Dashboard" role="evaluator">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading evaluations...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Evaluator Dashboard" role="evaluator">
      <div className="space-y-6">
        <Card className="border-accent/20 shadow-md">
          <CardHeader>
            <CardTitle>Pending Evaluations</CardTitle>
            <CardDescription>
              Review and grade submitted test responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-accent" />
                <span className="text-2xl font-bold">{pendingAttempts.length}</span>
                <span className="text-muted-foreground">tests waiting for evaluation</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {pendingAttempts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">All caught up!</p>
              <p className="text-sm text-muted-foreground">
                There are no pending evaluations at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingAttempts.map((attempt) => (
              <Card key={attempt.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">
                          Test {attempt.tests.test_number}
                        </Badge>
                        <h3 className="font-semibold">{attempt.tests.title}</h3>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{attempt.profiles.full_name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {attempt.profiles.employee_id}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Submitted {new Date(attempt.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button onClick={() => navigate(`/evaluate/${attempt.id}`)}>
                      Evaluate
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default EvaluatorDashboard;