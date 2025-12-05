import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, TrendingUp, Award, Activity, Search, CheckCircle2, XCircle, AlertTriangle, Edit, FileText } from "lucide-react";

interface Stats {
  totalEmployees: number;
  averageScore: number;
  completionRate: number;
  topPerformers: number;
}

interface CohortData {
  cohort: string;
  employeeCount: number;
  averageScore: number;
  completionRate: number;
  passRate: number;
}

interface EmployeePerformance {
  id: string;
  full_name: string;
  employee_id: string;
  cohort: string;
  testsCompleted: number;
  averageScore: number;
  passed: number;
  failed: number;
}

interface FailedAttempt {
  id: string;
  user_id: string;
  test_id: string;
  score: number;
  submitted_at: string;
  profiles: {
    full_name: string;
    employee_id: string;
  };
  tests: {
    title: string;
    test_number: number;
    passing_score: number;
  };
}

interface IndividualTestAttempt {
  id: string;
  user_id: string;
  test_id: string;
  score: number;
  passed: boolean;
  submitted_at: string;
  status: string;
  profiles: {
    full_name: string;
    employee_id: string;
    cohort: string;
  };
  tests: {
    title: string;
    test_number: number;
    passing_score: number;
  };
}

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    averageScore: 0,
    completionRate: 0,
    topPerformers: 0
  });
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [employeeData, setEmployeeData] = useState<EmployeePerformance[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<FailedAttempt[]>([]);
  const [individualAttempts, setIndividualAttempts] = useState<IndividualTestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [failedSearchTerm, setFailedSearchTerm] = useState("");
  const [individualSearchTerm, setIndividualSearchTerm] = useState("");

  useEffect(() => {
    fetchStats();
    fetchCohortData();
    fetchEmployeeData();
    fetchFailedAttempts();
    fetchIndividualTestAttempts();
  }, []);

  const fetchStats = async () => {
    try {
      const [employeesResult, attemptsResult] = await Promise.all([
        supabase.from("user_roles").select("id", { count: "exact" }).eq("role", "new_joinee"),
        supabase.from("test_attempts").select("score, passed").in("status", ["evaluated", "graded"])
      ]);

      const totalEmployees = employeesResult.count || 0;
      const attempts = attemptsResult.data || [];
      
      const totalScore = attempts.reduce((sum, a) => sum + (a.score || 0), 0);
      const averageScore = attempts.length > 0 ? Math.round(totalScore / attempts.length) : 0;
      const topPerformers = attempts.filter(a => (a.score || 0) >= 90).length;
      const completionRate = totalEmployees > 0 
        ? Math.round((attempts.filter(a => a.passed).length / totalEmployees) * 100)
        : 0;

      setStats({
        totalEmployees,
        averageScore,
        completionRate,
        topPerformers
      });
    } catch (error) {
      toast.error("Failed to load dashboard statistics");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCohortData = async () => {
    try {
      // Get all profiles with cohort info
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, cohort");
      
      if (profilesError) throw profilesError;

      // Get all test attempts
      const { data: attempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select("user_id, score, passed, status")
        .in("status", ["evaluated", "graded"]);
      
      if (attemptsError) throw attemptsError;

      // Group by cohort and track users with no failures
      const cohortMap = new Map<string, { 
        total: number; 
        scores: number[]; 
        passed: number;
        userAttempts: Map<string, { hasFailed: boolean; hasPassed: boolean }>;
      }>();
      
      profiles?.forEach(profile => {
        const cohort = profile.cohort || "Unassigned";
        if (!cohortMap.has(cohort)) {
          cohortMap.set(cohort, { 
            total: 0, 
            scores: [], 
            passed: 0,
            userAttempts: new Map()
          });
        }
        cohortMap.get(cohort)!.total++;
      });

      attempts?.forEach(attempt => {
        const profile = profiles?.find(p => p.id === attempt.user_id);
        const cohort = profile?.cohort || "Unassigned";
        const data = cohortMap.get(cohort);
        if (data) {
          data.scores.push(attempt.score || 0);
          if (attempt.passed) data.passed++;
          
          // Track per-user attempt status
          if (!data.userAttempts.has(attempt.user_id)) {
            data.userAttempts.set(attempt.user_id, { hasFailed: false, hasPassed: false });
          }
          const userStatus = data.userAttempts.get(attempt.user_id)!;
          if (attempt.passed === false) {
            userStatus.hasFailed = true;
          }
          if (attempt.passed === true) {
            userStatus.hasPassed = true;
          }
        }
      });

      const cohortResults: CohortData[] = Array.from(cohortMap.entries()).map(([cohort, data]) => {
        // Count users who passed ALL tests (no failures and at least one passed test)
        const usersWithNoFailures = Array.from(data.userAttempts.values()).filter(
          u => !u.hasFailed && u.hasPassed
        ).length;
        
        return {
          cohort,
          employeeCount: data.total,
          averageScore: data.scores.length > 0 
            ? Math.round(data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length)
            : 0,
          completionRate: data.total > 0 
            ? Math.round((usersWithNoFailures / data.total) * 100)
            : 0,
          passRate: data.scores.length > 0
            ? Math.round((data.passed / data.scores.length) * 100)
            : 0
        };
      });

      setCohortData(cohortResults.sort((a, b) => a.cohort.localeCompare(b.cohort)));
    } catch (error) {
      console.error("Failed to load cohort data:", error);
    }
  };

  const fetchEmployeeData = async () => {
    try {
      // Get all new joinee profiles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "new_joinee");
      
      if (rolesError) throw rolesError;
      const userIds = roles?.map(r => r.user_id) || [];

      if (userIds.length === 0) {
        setEmployeeData([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, employee_id, cohort")
        .in("id", userIds);
      
      if (profilesError) throw profilesError;

      const { data: attempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select("user_id, score, passed, status")
        .in("user_id", userIds)
        .in("status", ["evaluated", "graded"]);
      
      if (attemptsError) throw attemptsError;

      const employeePerformance: EmployeePerformance[] = profiles?.map(profile => {
        const userAttempts = attempts?.filter(a => a.user_id === profile.id) || [];
        const scores = userAttempts.map(a => a.score || 0);
        const avgScore = scores.length > 0 
          ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
          : 0;
        const passed = userAttempts.filter(a => a.passed).length;
        const failed = userAttempts.filter(a => !a.passed).length;

        return {
          id: profile.id,
          full_name: profile.full_name,
          employee_id: profile.employee_id,
          cohort: profile.cohort || "Unassigned",
          testsCompleted: userAttempts.length,
          averageScore: avgScore,
          passed,
          failed
        };
      }) || [];

      setEmployeeData(employeePerformance.sort((a, b) => a.full_name.localeCompare(b.full_name)));
    } catch (error) {
      console.error("Failed to load employee data:", error);
    }
  };

  const filteredEmployeeData = employeeData.filter(emp => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      emp.full_name.toLowerCase().includes(search) ||
      emp.employee_id.toLowerCase().includes(search) ||
      emp.cohort.toLowerCase().includes(search)
    );
  });

  const fetchIndividualTestAttempts = async () => {
    try {
      const { data: attempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select(`
          id,
          user_id,
          test_id,
          score,
          passed,
          submitted_at,
          status
        `)
        .in("status", ["evaluated", "graded"])
        .order("submitted_at", { ascending: false });

      if (attemptsError) throw attemptsError;
      if (!attempts || attempts.length === 0) {
        setIndividualAttempts([]);
        return;
      }

      const userIds = [...new Set(attempts.map(a => a.user_id))];
      const testIds = [...new Set(attempts.map(a => a.test_id))];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, employee_id, cohort")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const { data: tests, error: testsError } = await supabase
        .from("tests")
        .select("id, title, test_number, passing_score")
        .in("id", testIds);

      if (testsError) throw testsError;

      const combined = attempts.map(attempt => ({
        ...attempt,
        profiles: profiles?.find(p => p.id === attempt.user_id) || { 
          full_name: "Unknown", 
          employee_id: "N/A",
          cohort: "Unassigned"
        },
        tests: tests?.find(t => t.id === attempt.test_id) || { 
          title: "Unknown", 
          test_number: 0, 
          passing_score: 70 
        }
      }));

      setIndividualAttempts(combined as any);
    } catch (error) {
      console.error("Failed to load individual test attempts:", error);
    }
  };

  const filteredIndividualAttempts = individualAttempts.filter(attempt => {
    if (!individualSearchTerm) return true;
    const search = individualSearchTerm.toLowerCase();
    return (
      attempt.profiles.employee_id.toLowerCase().includes(search) ||
      attempt.profiles.full_name.toLowerCase().includes(search)
    );
  });

  const fetchFailedAttempts = async () => {
    try {
      const { data: attempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select(`
          id,
          user_id,
          test_id,
          score,
          submitted_at
        `)
        .eq("status", "evaluated")
        .eq("passed", false)
        .order("submitted_at", { ascending: false });

      if (attemptsError) throw attemptsError;
      if (!attempts || attempts.length === 0) {
        setFailedAttempts([]);
        return;
      }

      const userIds = [...new Set(attempts.map(a => a.user_id))];
      const testIds = [...new Set(attempts.map(a => a.test_id))];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, employee_id")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const { data: tests, error: testsError } = await supabase
        .from("tests")
        .select("id, title, test_number, passing_score")
        .in("id", testIds);

      if (testsError) throw testsError;

      const combined = attempts.map(attempt => ({
        ...attempt,
        profiles: profiles?.find(p => p.id === attempt.user_id) || { full_name: "Unknown", employee_id: "N/A" },
        tests: tests?.find(t => t.id === attempt.test_id) || { title: "Unknown", test_number: 0, passing_score: 70 }
      }));

      setFailedAttempts(combined as any);
    } catch (error) {
      console.error("Failed to load failed attempts:", error);
    }
  };

  const filteredFailedAttempts = failedAttempts.filter(attempt => {
    if (!failedSearchTerm) return true;
    const search = failedSearchTerm.toLowerCase();
    return (
      attempt.profiles.full_name.toLowerCase().includes(search) ||
      attempt.profiles.employee_id.toLowerCase().includes(search) ||
      attempt.tests.test_number.toString().includes(search)
    );
  });

  if (loading) {
    return (
      <Layout title="Manager Dashboard" role="manager">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Manager Dashboard" role="manager">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEmployees}</div>
              <p className="text-xs text-muted-foreground mt-1">Active new joinees</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageScore}%</div>
              <p className="text-xs text-muted-foreground mt-1">Across all tests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <Activity className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completionRate}%</div>
              <Progress value={stats.completionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
              <Award className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.topPerformers}</div>
              <p className="text-xs text-muted-foreground mt-1">Scored 90% or higher</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="failed">
              Failed Tests
              {failedAttempts.length > 0 && (
                <Badge variant="destructive" className="ml-2">{failedAttempts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="cohorts">By Cohort</TabsTrigger>
            <TabsTrigger value="individual">Individual Performance</TabsTrigger>
            <TabsTrigger value="reports">Report Cards</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>
                  Global assessment performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Overall Progress</p>
                      <p className="text-xs text-muted-foreground">Assessment completion status</p>
                    </div>
                    <Badge variant="outline" className="text-lg px-4 py-2">
                      {stats.completionRate}%
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Average Performance</p>
                      <p className="text-xs text-muted-foreground">Mean score across all completed tests</p>
                    </div>
                    <Badge variant="outline" className="text-lg px-4 py-2">
                      {stats.averageScore}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="failed" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <CardTitle>Failed Tests - Review Required</CardTitle>
                    <CardDescription>
                      Review and adjust scores for students who failed their assessments
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, Employee ID, or Test Number..."
                    value={failedSearchTerm}
                    onChange={(e) => setFailedSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {filteredFailedAttempts.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">
                      {failedSearchTerm ? "No results found" : "No failed attempts to review"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {failedSearchTerm 
                        ? "Try adjusting your search criteria"
                        : "All students have passed their assessments or no evaluations are complete yet."}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Test</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Passing Score</TableHead>
                        <TableHead className="text-right">Gap</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFailedAttempts.map((attempt) => {
                        const gap = attempt.tests.passing_score - attempt.score;
                        return (
                          <TableRow key={attempt.id} className="bg-destructive/5">
                            <TableCell>
                              <div>
                                <div className="font-medium">{attempt.profiles.full_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {attempt.profiles.employee_id}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <Badge variant="outline" className="mb-1">
                                  Test {attempt.tests.test_number}
                                </Badge>
                                <div className="text-sm">{attempt.tests.title}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(attempt.submitted_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="destructive">{attempt.score}%</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{attempt.tests.passing_score}%</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                                -{gap}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => navigate(`/manager-review/${attempt.id}`)}
                                className="gap-2"
                              >
                                <Edit className="h-3 w-3" />
                                Review & Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cohorts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cohort Analysis</CardTitle>
                <CardDescription>
                  Performance breakdown by employee cohort
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cohortData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No cohort data available yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cohort</TableHead>
                        <TableHead className="text-right">Employees</TableHead>
                        <TableHead className="text-right">Avg Score</TableHead>
                        <TableHead className="text-right">Completion</TableHead>
                        <TableHead className="text-right">Pass Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cohortData.map((cohort) => (
                        <TableRow key={cohort.cohort}>
                          <TableCell className="font-medium">{cohort.cohort}</TableCell>
                          <TableCell className="text-right">{cohort.employeeCount}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{cohort.averageScore}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={cohort.completionRate} className="w-16" />
                              <span className="text-sm">{cohort.completionRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={cohort.passRate >= 70 ? "default" : "destructive"}>
                              {cohort.passRate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="individual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Individual Test Attempts</CardTitle>
                <CardDescription>
                  All test attempts with detailed results for each employee
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by Employee ID or name..."
                      value={individualSearchTerm}
                      onChange={(e) => setIndividualSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {individualSearchTerm && (
                    <Button
                      variant="outline"
                      onClick={() => setIndividualSearchTerm("")}
                      className="shrink-0"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {filteredIndividualAttempts.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">
                      {individualSearchTerm ? "No results found" : "No test attempts available"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {individualSearchTerm 
                        ? "Try adjusting your search criteria"
                        : "Test attempts will appear here once employees complete their assessments."}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Cohort</TableHead>
                        <TableHead>Test</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIndividualAttempts.map((attempt) => (
                        <TableRow key={attempt.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{attempt.profiles.full_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {attempt.profiles.employee_id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{attempt.profiles.cohort}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <Badge variant="outline" className="mb-1">
                                Test {attempt.tests.test_number}
                              </Badge>
                              <div className="text-sm">{attempt.tests.title}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant={attempt.passed ? "default" : "destructive"}
                              className={attempt.passed ? "bg-green-600" : ""}
                            >
                              {attempt.score}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {attempt.passed ? (
                              <Badge className="bg-green-600 hover:bg-green-700 text-white gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Passed
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(attempt.submitted_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Report Cards
                </CardTitle>
                <CardDescription>
                  View detailed test scores for all employees
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  View report cards showing scored marks / total marks for each test, with filters by cohort and user ID.
                </p>
                <Button onClick={() => navigate("/report-card")}>
                  <FileText className="mr-2 h-4 w-4" />
                  View Report Cards
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ManagerDashboard;