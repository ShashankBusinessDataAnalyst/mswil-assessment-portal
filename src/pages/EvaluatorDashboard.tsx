import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ClipboardCheck, User, Calendar, ArrowRight, CheckCircle2, XCircle, Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PendingAttempt {
  id: string;
  user_id: string;
  test_id: string;
  submitted_at: string;
  profiles: {
    full_name: string;
    employee_id: string;
    user_id: string;
  };
  tests: {
    title: string;
    test_number: number;
  };
}

interface EvaluatedAttempt {
  id: string;
  user_id: string;
  test_id: string;
  submitted_at: string;
  score: number;
  passed: boolean;
  profiles: {
    full_name: string;
    employee_id: string;
    user_id: string;
  };
  tests: {
    title: string;
    test_number: number;
    passing_score: number;
  };
  evaluations: Array<{
    evaluated_at: string;
  }>;
}

const EvaluatorDashboard = () => {
  const navigate = useNavigate();
  const [pendingAttempts, setPendingAttempts] = useState<PendingAttempt[]>([]);
  const [evaluatedAttempts, setEvaluatedAttempts] = useState<EvaluatedAttempt[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingSearch, setPendingSearch] = useState("");
  const [evaluatedSearch, setEvaluatedSearch] = useState("");

  useEffect(() => {
    fetchPendingAttempts();
    fetchEvaluatedAttempts();
    fetchCompletedCount();
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
        .select("id, full_name, employee_id, user_id")
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

  const fetchEvaluatedAttempts = async () => {
    try {
      const { data: attempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select(`
          id,
          user_id,
          test_id,
          submitted_at,
          score,
          passed
        `)
        .eq("status", "evaluated")
        .order("submitted_at", { ascending: false });

      if (attemptsError) throw attemptsError;
      if (!attempts || attempts.length === 0) {
        setEvaluatedAttempts([]);
        return;
      }

      const userIds = [...new Set(attempts.map(a => a.user_id))];
      const testIds = [...new Set(attempts.map(a => a.test_id))];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, employee_id, user_id")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const { data: tests, error: testsError } = await supabase
        .from("tests")
        .select("id, title, test_number, passing_score")
        .in("id", testIds);

      if (testsError) throw testsError;

      const { data: evaluations, error: evaluationsError } = await supabase
        .from("evaluations")
        .select("attempt_id, evaluated_at")
        .in("attempt_id", attempts.map(a => a.id))
        .order("evaluated_at", { ascending: false });

      if (evaluationsError) throw evaluationsError;

      const combined = attempts.map(attempt => ({
        ...attempt,
        profiles: profiles?.find(p => p.id === attempt.user_id) || { full_name: "Unknown", employee_id: "N/A" },
        tests: tests?.find(t => t.id === attempt.test_id) || { title: "Unknown", test_number: 0, passing_score: 70 },
        evaluations: evaluations?.filter(e => e.attempt_id === attempt.id) || []
      }));

      setEvaluatedAttempts(combined as any);
    } catch (error) {
      toast.error("Failed to load evaluated tests");
      console.error(error);
    }
  };

  const fetchCompletedCount = async () => {
    try {
      const { count, error } = await supabase
        .from("test_attempts")
        .select("*", { count: 'exact', head: true })
        .eq("status", "evaluated");

      if (error) throw error;
      setCompletedCount(count || 0);
    } catch (error) {
      console.error("Failed to load completed count:", error);
    }
  };

  // Filter pending attempts based on search
  const filteredPendingAttempts = pendingAttempts.filter(attempt => {
    if (!pendingSearch) return true;
    const searchLower = pendingSearch.toLowerCase();
    return attempt.profiles.employee_id?.toLowerCase().includes(searchLower);
  });

  // Filter evaluated attempts based on search
  const filteredEvaluatedAttempts = evaluatedAttempts.filter(attempt => {
    if (!evaluatedSearch) return true;
    const searchLower = evaluatedSearch.toLowerCase();
    return attempt.profiles.employee_id?.toLowerCase().includes(searchLower);
  });

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-accent/20 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Pending Evaluations</CardTitle>
              <CardDescription>
                Tests waiting for evaluation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-8 w-8 text-accent" />
                <span className="text-4xl font-bold">{pendingAttempts.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/20 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Completed Evaluations</CardTitle>
              <CardDescription>
                Tests already evaluated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-8 w-8 text-primary" />
                <span className="text-4xl font-bold">{completedCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/20 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Report Cards</CardTitle>
              <CardDescription>
                View test scores by employee
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/report-card')} variant="outline" className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                View Report Cards
              </Button>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">
              Pending Evaluations ({pendingAttempts.length})
            </TabsTrigger>
            <TabsTrigger value="evaluated">
              Evaluated Tests ({evaluatedAttempts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Employee ID (e.g., NJ007)..."
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {filteredPendingAttempts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">
                    {pendingSearch ? "No results found" : "All caught up!"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {pendingSearch 
                      ? "Try adjusting your search criteria"
                      : "There are no pending evaluations at the moment."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredPendingAttempts.map((attempt) => (
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
          </TabsContent>

          <TabsContent value="evaluated" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Employee ID (e.g., NJ007)..."
                value={evaluatedSearch}
                onChange={(e) => setEvaluatedSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {filteredEvaluatedAttempts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">
                    {evaluatedSearch ? "No results found" : "No evaluated tests yet"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {evaluatedSearch 
                      ? "Try adjusting your search criteria"
                      : "Evaluated tests will appear here once you complete evaluations."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Evaluated</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-center">Result</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvaluatedAttempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell>
                          <div>
                            <Badge variant="outline" className="mb-1">
                              Test {attempt.tests.test_number}
                            </Badge>
                            <div className="font-medium">{attempt.tests.title}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{attempt.profiles.full_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {attempt.profiles.employee_id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(attempt.submitted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {attempt.evaluations[0]?.evaluated_at 
                            ? new Date(attempt.evaluations[0].evaluated_at).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">
                            {attempt.score}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {attempt.passed ? (
                            <Badge className="bg-green-600 hover:bg-green-700 text-white gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Pass
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Fail
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/evaluate/${attempt.id}`)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default EvaluatorDashboard;