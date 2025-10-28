import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, TrendingUp, Award, Activity, Search, CheckCircle2, XCircle } from "lucide-react";

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

const ManagerDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    averageScore: 0,
    completionRate: 0,
    topPerformers: 0
  });
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [employeeData, setEmployeeData] = useState<EmployeePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchStats();
    fetchCohortData();
    fetchEmployeeData();
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

      // Group by cohort
      const cohortMap = new Map<string, { total: number; scores: number[]; passed: number }>();
      
      profiles?.forEach(profile => {
        const cohort = profile.cohort || "Unassigned";
        if (!cohortMap.has(cohort)) {
          cohortMap.set(cohort, { total: 0, scores: [], passed: 0 });
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
        }
      });

      const cohortResults: CohortData[] = Array.from(cohortMap.entries()).map(([cohort, data]) => ({
        cohort,
        employeeCount: data.total,
        averageScore: data.scores.length > 0 
          ? Math.round(data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length)
          : 0,
        completionRate: data.total > 0 
          ? Math.round((data.scores.length / data.total) * 100)
          : 0,
        passRate: data.scores.length > 0
          ? Math.round((data.passed / data.scores.length) * 100)
          : 0
      }));

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
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cohorts">By Cohort</TabsTrigger>
            <TabsTrigger value="individual">Individual Performance</TabsTrigger>
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
                <CardTitle>Individual Performance</CardTitle>
                <CardDescription>
                  Detailed view of each employee's test results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, Employee ID, or cohort..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {filteredEmployeeData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {searchTerm ? "No employees found matching your search." : "No employee data available yet."}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Cohort</TableHead>
                        <TableHead className="text-right">Tests Completed</TableHead>
                        <TableHead className="text-right">Avg Score</TableHead>
                        <TableHead className="text-center">Passed</TableHead>
                        <TableHead className="text-center">Failed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployeeData.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{employee.full_name}</div>
                              <div className="text-xs text-muted-foreground">{employee.employee_id}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{employee.cohort}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{employee.testsCompleted}</TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant={employee.averageScore >= 70 ? "default" : "secondary"}
                              className={employee.averageScore >= 70 ? "bg-green-600" : ""}
                            >
                              {employee.averageScore}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {employee.passed > 0 ? (
                              <Badge className="bg-green-600 hover:bg-green-700 text-white gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {employee.passed}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {employee.failed > 0 ? (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                {employee.failed}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ManagerDashboard;