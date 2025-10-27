import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ClipboardList, Lock, PlayCircle, CheckCircle2, Clock } from "lucide-react";

interface Test {
  id: string;
  test_number: number;
  title: string;
  description: string;
  time_limit_minutes: number;
}

interface TestAttempt {
  id: string;
  test_id: string;
  status: string;
  score: number | null;
  passed: boolean | null;
}

const NewJoineeDashboard = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState<Test[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestsAndAttempts();
  }, []);

  const fetchTestsAndAttempts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [testsResult, attemptsResult] = await Promise.all([
        supabase.from("tests").select("*").eq("is_active", true).order("test_number"),
        supabase.from("test_attempts").select("*").eq("user_id", user.id)
      ]);

      if (testsResult.error) throw testsResult.error;
      if (attemptsResult.error) throw attemptsResult.error;

      setTests(testsResult.data || []);
      setAttempts(attemptsResult.data || []);
    } catch (error) {
      toast.error("Failed to load tests");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getTestStatus = (test: Test) => {
    const attempt = attempts.find(a => a.test_id === test.id);
    
    if (attempt) {
      if (attempt.status === "submitted" || attempt.status === "evaluated" || attempt.status === "graded") {
        return { status: "completed", label: "Completed", icon: CheckCircle2, color: "success" };
      }
      if (attempt.status === "in_progress") {
        return { status: "in_progress", label: "In Progress", icon: Clock, color: "warning" };
      }
    }

    // Check if previous test is completed (submitted)
    if (test.test_number > 1) {
      const prevTest = tests.find(t => t.test_number === test.test_number - 1);
      if (prevTest) {
        const prevAttempt = attempts.find(a => a.test_id === prevTest.id);
        const isPrevCompleted = prevAttempt && 
          (prevAttempt.status === "submitted" || 
           prevAttempt.status === "evaluated" || 
           prevAttempt.status === "graded");
        
        if (!isPrevCompleted) {
          return { status: "locked", label: "Locked", icon: Lock, color: "muted" };
        }
      }
    }

    return { status: "available", label: "Start Test", icon: PlayCircle, color: "primary" };
  };

  const handleStartTest = async (test: Test) => {
    const status = getTestStatus(test);
    if (status.status === "locked") {
      toast.error("Complete the previous test first");
      return;
    }

    if (status.status === "completed") {
      toast.info("You have already completed this test");
      return;
    }

    navigate(`/test/${test.id}`);
  };

  const completedTests = attempts.filter(a => 
    a.status === "submitted" || a.status === "evaluated" || a.status === "graded"
  ).length;
  const progressPercentage = tests.length > 0 ? (completedTests / tests.length) * 100 : 0;

  if (loading) {
    return (
      <Layout title="My Tests" role="new_joinee">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading tests...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="My Tests" role="new_joinee">
      <div className="space-y-6">
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle>Assessment Progress</CardTitle>
            <CardDescription>Complete all tests to finish your onboarding</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tests Completed</span>
                <span className="font-medium">{completedTests} of {tests.length}</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => {
            const status = getTestStatus(test);
            const StatusIcon = status.icon;
            const attempt = attempts.find(a => a.test_id === test.id);

            return (
              <Card 
                key={test.id} 
                className={`border-2 ${
                  status.status === "completed" 
                    ? "border-green-500 bg-green-50 dark:bg-green-950/20" 
                    : status.status === "locked" 
                    ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                    : status.status === "available"
                    ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                    : "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Badge variant="outline" className="mb-2">
                        Test {test.test_number}
                      </Badge>
                      <CardTitle className="text-lg">{test.title}</CardTitle>
                    </div>
                    <StatusIcon className={`h-5 w-5 text-${status.color}`} />
                  </div>
                  <CardDescription className="line-clamp-2">{test.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {test.time_limit_minutes && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{test.time_limit_minutes} minutes</span>
                    </div>
                  )}
                  
                  {attempt?.score !== null && attempt?.score !== undefined && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium">Score</span>
                      <span className="text-lg font-bold">{attempt.score}%</span>
                    </div>
                  )}

                  <Button
                    onClick={() => handleStartTest(test)}
                    disabled={status.status === "locked" || status.status === "completed"}
                    className="w-full"
                    variant={status.status === "available" ? "default" : "outline"}
                  >
                    <StatusIcon className="h-4 w-4 mr-2" />
                    {status.label}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default NewJoineeDashboard;