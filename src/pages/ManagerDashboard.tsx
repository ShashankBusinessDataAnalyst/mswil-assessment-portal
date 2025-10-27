import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Users, TrendingUp, Award, Activity } from "lucide-react";

interface Stats {
  totalEmployees: number;
  averageScore: number;
  completionRate: number;
  topPerformers: number;
}

const ManagerDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    averageScore: 0,
    completionRate: 0,
    topPerformers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
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
                <p className="text-sm text-muted-foreground">
                  Cohort-based analytics will show performance metrics grouped by employee intake batch.
                </p>
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
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View individual employee progress, scores, and evaluation history.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ManagerDashboard;