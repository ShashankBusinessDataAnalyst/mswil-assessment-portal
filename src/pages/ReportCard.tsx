import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, FileText, CheckCircle2, XCircle, User } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  employee_id: string;
  user_id: string | null;
  cohort: string | null;
}

interface TestResult {
  testName: string;
  testNumber: number;
  scoredMarks: number;
  totalMarks: number;
  passed: boolean;
}

interface UserReport {
  profile: Profile;
  tests: TestResult[];
  totalScored: number;
  totalPossible: number;
}

const ReportCard = () => {
  const [cohorts, setCohorts] = useState<string[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>("all");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchUserRole();
    fetchCohorts();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [selectedCohort, userIdFilter]);

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      setUserRole(data?.role || null);
    }
  };

  const fetchCohorts = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("cohort")
        .not("cohort", "is", null);

      if (error) throw error;

      const uniqueCohorts = [...new Set(data?.map(p => p.cohort).filter(Boolean))] as string[];
      setCohorts(uniqueCohorts.sort());
    } catch (error) {
      console.error("Failed to fetch cohorts:", error);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Fetch profiles based on filters
      let profilesQuery = supabase.from("profiles").select("*");
      
      if (selectedCohort && selectedCohort !== "all") {
        if (selectedCohort === "unassigned") {
          profilesQuery = profilesQuery.is("cohort", null);
        } else {
          profilesQuery = profilesQuery.eq("cohort", selectedCohort);
        }
      }

      const { data: profiles, error: profilesError } = await profilesQuery;
      if (profilesError) throw profilesError;

      // Filter by user_id if provided
      let filteredProfiles = profiles || [];
      if (userIdFilter) {
        filteredProfiles = filteredProfiles.filter(p => 
          p.user_id?.toLowerCase().includes(userIdFilter.toLowerCase()) ||
          p.employee_id?.toLowerCase().includes(userIdFilter.toLowerCase())
        );
      }

      if (filteredProfiles.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // Fetch test attempts for these users
      const userIds = filteredProfiles.map(p => p.id);
      const { data: attempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select("id, user_id, test_id, passed, status")
        .in("user_id", userIds)
        .in("status", ["evaluated", "graded"]);

      if (attemptsError) throw attemptsError;

      if (!attempts || attempts.length === 0) {
        // Return profiles with no test data
        const emptyReports = filteredProfiles.map(profile => ({
          profile,
          tests: [],
          totalScored: 0,
          totalPossible: 0
        }));
        setReports(emptyReports);
        setLoading(false);
        return;
      }

      // Fetch test details
      const testIds = [...new Set(attempts.map(a => a.test_id))];
      const { data: tests, error: testsError } = await supabase
        .from("tests")
        .select("id, title, test_number")
        .in("id", testIds);

      if (testsError) throw testsError;

      // Fetch test questions for total marks
      const { data: questions, error: questionsError } = await supabase
        .from("test_questions")
        .select("test_id, max_points")
        .in("test_id", testIds);

      if (questionsError) throw questionsError;

      // Calculate total marks per test
      const testTotalMarks: Record<string, number> = {};
      questions?.forEach(q => {
        testTotalMarks[q.test_id] = (testTotalMarks[q.test_id] || 0) + (q.max_points || 0);
      });

      // Fetch responses for scored marks
      const attemptIds = attempts.map(a => a.id);
      const { data: responses, error: responsesError } = await supabase
        .from("test_responses")
        .select("attempt_id, points_awarded")
        .in("attempt_id", attemptIds);

      if (responsesError) throw responsesError;

      // Calculate scored marks per attempt
      const attemptScoredMarks: Record<string, number> = {};
      responses?.forEach(r => {
        attemptScoredMarks[r.attempt_id] = (attemptScoredMarks[r.attempt_id] || 0) + (r.points_awarded || 0);
      });

      // Build reports
      const userReports: UserReport[] = filteredProfiles.map(profile => {
        const userAttempts = attempts.filter(a => a.user_id === profile.id);
        const testResults: TestResult[] = userAttempts.map(attempt => {
          const test = tests?.find(t => t.id === attempt.test_id);
          return {
            testName: test?.title || "Unknown Test",
            testNumber: test?.test_number || 0,
            scoredMarks: attemptScoredMarks[attempt.id] || 0,
            totalMarks: testTotalMarks[attempt.test_id] || 0,
            passed: attempt.passed || false
          };
        }).sort((a, b) => a.testNumber - b.testNumber);

        const totalScored = testResults.reduce((sum, t) => sum + t.scoredMarks, 0);
        const totalPossible = testResults.reduce((sum, t) => sum + t.totalMarks, 0);

        return {
          profile,
          tests: testResults,
          totalScored,
          totalPossible
        };
      });

      // Sort by full name
      userReports.sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name));
      setReports(userReports);
    } catch (error) {
      toast.error("Failed to load report cards");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleForLayout = () => {
    if (userRole === "admin") return "admin";
    if (userRole === "manager") return "manager";
    return "evaluator";
  };

  return (
    <Layout title="Report Card" role={getRoleForLayout()}>
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Card
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Filter by Cohort</label>
                <Select value={selectedCohort} onValueChange={setSelectedCohort}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cohorts</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {cohorts.map(cohort => (
                      <SelectItem key={cohort} value={cohort}>{cohort}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Filter by User ID / Employee ID</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by User ID or Employee ID..."
                    value={userIdFilter}
                    onChange={(e) => setUserIdFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && reports.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No Reports Found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or check if there are evaluated tests.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Report Cards */}
        {!loading && reports.map(report => (
          <Card key={report.profile.id} className="overflow-hidden">
            <CardHeader className="bg-muted/30">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{report.profile.full_name}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{report.profile.user_id || report.profile.employee_id}</span>
                      {report.profile.cohort && (
                        <>
                          <span>•</span>
                          <Badge variant="outline">{report.profile.cohort}</Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {report.tests.length > 0 && (
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {report.totalScored} / {report.totalPossible}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Overall: {report.totalPossible > 0 
                        ? Math.round((report.totalScored / report.totalPossible) * 100) 
                        : 0}%
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {report.tests.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No evaluated tests yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test Name</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.tests.map((test, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="shrink-0">
                              Test {test.testNumber}
                            </Badge>
                            <span className="font-medium">{test.testName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-lg">
                            {test.scoredMarks} / {test.totalMarks}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {test.passed ? (
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
};

export default ReportCard;
