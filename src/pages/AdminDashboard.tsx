import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Users, ClipboardList, UserCog, BarChart3 } from "lucide-react";
import CreateUserForm from "@/components/CreateUserForm";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTests: 0,
    pendingEvaluations: 0,
    completedAttempts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersResult, testsResult, attemptsResult, evaluationsResult] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("tests").select("id", { count: "exact" }),
        supabase.from("test_attempts").select("id", { count: "exact" }).eq("status", "submitted"),
        supabase.from("test_attempts").select("id", { count: "exact" }).in("status", ["evaluated", "graded"])
      ]);

      setStats({
        totalUsers: usersResult.count || 0,
        totalTests: testsResult.count || 0,
        pendingEvaluations: attemptsResult.count || 0,
        completedAttempts: evaluationsResult.count || 0
      });
    } catch (error) {
      toast.error("Failed to load dashboard statistics");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: "Total Users", value: stats.totalUsers, icon: Users, color: "primary" },
    { title: "Active Tests", value: stats.totalTests, icon: ClipboardList, color: "accent" },
    { title: "Pending Evaluations", value: stats.pendingEvaluations, icon: UserCog, color: "warning" },
    { title: "Completed", value: stats.completedAttempts, icon: BarChart3, color: "success" }
  ];

  if (loading) {
    return (
      <Layout title="Admin Dashboard" role="admin">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Dashboard" role="admin">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <Icon className={`h-4 w-4 text-${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="tests">Test Management</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
                <CardDescription>
                  Monitor the assessment system performance and usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Use the tabs above to manage users and tests. The system is operating normally.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <CreateUserForm />
          </TabsContent>

          <TabsContent value="tests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Test Management</CardTitle>
                <CardDescription>
                  Configure tests, questions, and evaluation criteria
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Test management features include:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Create and edit test questions (MCQ and text-based)</li>
                  <li>Set passing scores and time limits</li>
                  <li>Unlock graded tests for specific users</li>
                  <li>View test completion statistics</li>
                </ul>
                <Button>Manage Tests</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminDashboard;