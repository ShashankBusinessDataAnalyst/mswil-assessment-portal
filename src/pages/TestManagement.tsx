import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TestManagement = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    test_number: "",
    time_limit_minutes: "",
    passing_score: "70"
  });

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const { data, error } = await supabase
        .from("tests")
        .select("*")
        .order("test_number", { ascending: true });

      if (error) throw error;
      setTests(data || []);
    } catch (error) {
      toast.error("Failed to load tests");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.test_number) {
      toast.error("Title and test number are required");
      return;
    }

    try {
      const testData = {
        title: formData.title,
        description: formData.description,
        test_number: parseInt(formData.test_number),
        time_limit_minutes: formData.time_limit_minutes ? parseInt(formData.time_limit_minutes) : null,
        passing_score: parseInt(formData.passing_score)
      };

      if (editingTest) {
        const { error } = await supabase
          .from("tests")
          .update(testData)
          .eq("id", editingTest.id);

        if (error) throw error;
        toast.success("Test updated successfully");
      } else {
        const { error } = await supabase
          .from("tests")
          .insert(testData);

        if (error) throw error;
        toast.success("Test created successfully");
      }

      setDialogOpen(false);
      setEditingTest(null);
      setFormData({
        title: "",
        description: "",
        test_number: "",
        time_limit_minutes: "",
        passing_score: "70"
      });
      fetchTests();
    } catch (error) {
      toast.error(editingTest ? "Failed to update test" : "Failed to create test");
      console.error(error);
    }
  };

  const handleEdit = (test: any) => {
    setEditingTest(test);
    setFormData({
      title: test.title,
      description: test.description || "",
      test_number: test.test_number.toString(),
      time_limit_minutes: test.time_limit_minutes?.toString() || "",
      passing_score: test.passing_score.toString()
    });
    setDialogOpen(true);
  };

  const handleDelete = async (testId: string) => {
    if (!confirm("Are you sure you want to delete this test?")) return;

    try {
      const { error } = await supabase
        .from("tests")
        .delete()
        .eq("id", testId);

      if (error) throw error;
      toast.success("Test deleted successfully");
      fetchTests();
    } catch (error) {
      toast.error("Failed to delete test");
      console.error(error);
    }
  };

  const toggleTestStatus = async (testId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("tests")
        .update({ is_active: !currentStatus })
        .eq("id", testId);

      if (error) throw error;
      toast.success(`Test ${!currentStatus ? "activated" : "deactivated"} successfully`);
      fetchTests();
    } catch (error) {
      toast.error("Failed to update test status");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <Layout title="Test Management" role="admin">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading tests...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Test Management" role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate("/admin")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingTest(null);
                setFormData({
                  title: "",
                  description: "",
                  test_number: "",
                  time_limit_minutes: "",
                  passing_score: "70"
                });
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Create Test
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingTest ? "Edit Test" : "Create New Test"}</DialogTitle>
                <DialogDescription>
                  {editingTest ? "Update test details" : "Add a new test to the system"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Test Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Technical Assessment Module 1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter test description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="test_number">Test Number</Label>
                    <Input
                      id="test_number"
                      type="number"
                      value={formData.test_number}
                      onChange={(e) => setFormData({ ...formData, test_number: e.target.value })}
                      placeholder="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time_limit">Time Limit (min)</Label>
                    <Input
                      id="time_limit"
                      type="number"
                      value={formData.time_limit_minutes}
                      onChange={(e) => setFormData({ ...formData, time_limit_minutes: e.target.value })}
                      placeholder="60"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passing_score">Passing Score (%)</Label>
                    <Input
                      id="passing_score"
                      type="number"
                      value={formData.passing_score}
                      onChange={(e) => setFormData({ ...formData, passing_score: e.target.value })}
                      placeholder="70"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingTest ? "Update Test" : "Create Test"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Tests</CardTitle>
            <CardDescription>
              Manage tests, questions, and evaluation criteria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Time Limit</TableHead>
                  <TableHead>Passing Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No tests found. Create your first test above.
                    </TableCell>
                  </TableRow>
                ) : (
                  tests.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell className="font-medium">{test.test_number}</TableCell>
                      <TableCell>{test.title}</TableCell>
                      <TableCell>
                        {test.time_limit_minutes ? `${test.time_limit_minutes} min` : "No limit"}
                      </TableCell>
                      <TableCell>{test.passing_score}%</TableCell>
                      <TableCell>
                        <Badge 
                          variant={test.is_active ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => toggleTestStatus(test.id, test.is_active)}
                        >
                          {test.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(test)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(test.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TestManagement;
