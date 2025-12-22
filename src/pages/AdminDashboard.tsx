import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, ClipboardList, UserCog, BarChart3, FileText, Trash2, Loader2, Pencil } from "lucide-react";
import CreateUserForm from "@/components/CreateUserForm";
import EditUserDialog from "@/components/EditUserDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTests: 0,
    pendingEvaluations: 0,
    completedAttempts: 0
  });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [cohortEvaluations, setCohortEvaluations] = useState<any[]>([]);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchCohortEvaluations();
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

  const fetchUsers = async () => {
    try {
      // Fetch profiles and user_roles
      const [profilesResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role")
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (rolesResult.error) throw rolesResult.error;

      // Combine the data
      const usersWithRoles = profilesResult.data.map(profile => ({
        ...profile,
        userId: profile.user_id || profile.employee_id, // Use user_id or fallback to employee_id
        user_roles: rolesResult.data.filter(role => role.user_id === profile.id)
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      toast.error("Failed to load users");
    }
  };

  const fetchCohortEvaluations = async () => {
    try {
      // Fetch test attempts with evaluations and user profiles
      const { data: attempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select(`
          id,
          test_id,
          user_id,
          status,
          score,
          passed,
          submitted_at,
          tests (
            title,
            test_number
          )
        `)
        .in("status", ["evaluated", "graded"])
        .order("submitted_at", { ascending: false });

      if (attemptsError) throw attemptsError;

      // Fetch profiles with cohort information
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, employee_id, cohort");

      if (profilesError) throw profilesError;

      // Combine attempts with profile data
      const attemptsWithProfiles = attempts?.map(attempt => {
        const profile = profiles?.find(p => p.id === attempt.user_id);
        return {
          ...attempt,
          profile
        };
      }) || [];

      // Group by cohort
      const groupedByCohort = attemptsWithProfiles.reduce((acc: any, attempt: any) => {
        const cohort = attempt.profile?.cohort || "Unassigned";
        if (!acc[cohort]) {
          acc[cohort] = [];
        }
        acc[cohort].push(attempt);
        return acc;
      }, {});

      // Convert to array format for easier rendering
      const cohortData = Object.entries(groupedByCohort).map(([cohort, attempts]: [string, any]) => ({
        cohort,
        attempts,
        totalAttempts: attempts.length,
        averageScore: attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / attempts.length,
        passRate: (attempts.filter((a: any) => a.passed).length / attempts.length) * 100
      }));

      setCohortEvaluations(cohortData);
    } catch (error) {
      toast.error("Failed to load cohort evaluations");
    }
  };

  const handleCleanupOrphanUsers = async () => {
    setCleanupLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('cleanup-orphan-users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Cleanup complete! Deleted ${data.deletedCount} orphaned users.`);
        if (data.deletedCount > 0) {
          console.log('Deleted users:', data.deleted);
        }
        if (data.errors?.length > 0) {
          console.warn('Some deletions failed:', data.errors);
          toast.warning(`${data.errors.length} users could not be deleted`);
        }
      } else {
        throw new Error(data.error || 'Cleanup failed');
      }
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast.error(error.message || 'Failed to cleanup orphan users');
    } finally {
      setCleanupLoading(false);
    }
  };

  const statCards = [
    { title: "Total Users", value: stats.totalUsers, icon: Users, color: "primary" },
    { title: "Active Tests", value: stats.totalTests, icon: ClipboardList, color: "accent" },
    { title: "Pending Evaluations", value: stats.pendingEvaluations, icon: UserCog, color: "warning" },
    { title: "Completed", value: stats.completedAttempts, icon: BarChart3, color: "success" }
  ];

  // Filter users by role
  const filteredUsers = roleFilter === "all" 
    ? users 
    : users.filter(user => user.user_roles?.some((ur: any) => ur.role === roleFilter));

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
            <TabsTrigger value="create">Create User</TabsTrigger>
            <TabsTrigger value="users">Users List</TabsTrigger>
            <TabsTrigger value="evaluations">Evaluations by Cohort</TabsTrigger>
            <TabsTrigger value="tests">Test Management</TabsTrigger>
            <TabsTrigger value="reports">Report Cards</TabsTrigger>
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

          <TabsContent value="create" className="space-y-4">
            <div className="flex justify-end mb-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Cleanup Orphan Users
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cleanup Orphan Users</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all auth users that don't have any assigned roles. 
                      This is useful when old users exist in the system without proper role assignments.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleCleanupOrphanUsers}
                      disabled={cleanupLoading}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {cleanupLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cleaning up...
                        </>
                      ) : (
                        'Confirm Cleanup'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <CreateUserForm />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Users by Role</CardTitle>
                    <CardDescription>
                      View all system users organized by their assigned roles
                    </CardDescription>
                  </div>
                  <div className="w-[200px]">
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="new_joinee">New Joinee</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="evaluator">Evaluator</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Cohort</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>
                            {user.user_roles?.map((ur: any, idx: number) => (
                              <Badge key={idx} variant="outline" className="mr-1 capitalize">
                                {ur.role.replace('_', ' ')}
                              </Badge>
                            ))}
                          </TableCell>
                          <TableCell>{user.userId}</TableCell>
                          <TableCell>{user.employee_id}</TableCell>
                          <TableCell>{user.cohort || '-'}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUser(user);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evaluations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evaluations by Cohort</CardTitle>
                <CardDescription>
                  View evaluation performance metrics grouped by cohort
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cohortEvaluations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No evaluations found. Evaluations will appear here once tests are graded.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {cohortEvaluations.map((cohortData) => (
                      <Card key={cohortData.cohort}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Cohort: {cohortData.cohort}</CardTitle>
                            <div className="flex gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Total: </span>
                                <span className="font-medium">{cohortData.totalAttempts}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Avg Score: </span>
                                <span className="font-medium">{cohortData.averageScore.toFixed(1)}%</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Pass Rate: </span>
                                <span className="font-medium">{cohortData.passRate.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Employee Name</TableHead>
                                <TableHead>Employee ID</TableHead>
                                <TableHead>Test</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Submitted</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {cohortData.attempts.map((attempt: any) => (
                                <TableRow key={attempt.id}>
                                  <TableCell className="font-medium">
                                    {attempt.profile?.full_name || 'N/A'}
                                  </TableCell>
                                  <TableCell>{attempt.profile?.employee_id || 'N/A'}</TableCell>
                                  <TableCell>
                                    {attempt.tests?.title || `Test #${attempt.tests?.test_number}`}
                                  </TableCell>
                                  <TableCell>
                                    <span className={attempt.score >= 70 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                      {attempt.score || 0}%
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={attempt.passed ? "default" : "destructive"}>
                                      {attempt.passed ? "Passed" : "Failed"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString() : 'N/A'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
                <Button onClick={() => navigate("/admin/tests")}>Manage Tests</Button>
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

        <EditUserDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={selectedUser}
          onSuccess={fetchUsers}
        />
      </div>
    </Layout>
  );
};

export default AdminDashboard;