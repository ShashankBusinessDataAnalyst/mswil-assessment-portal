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
import { Plus, Edit, Trash2, ArrowLeft, FileQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import { testSchema, questionSchema, validateMCQQuestion } from "@/lib/validation";

const TestManagement = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<any>(null);
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    test_number: "",
    time_limit_minutes: "",
    passing_score: "70"
  });
  const [questionForm, setQuestionForm] = useState({
    question_text: "",
    question_type: "mcq" as "mcq" | "text",
    question_number: "",
    max_points: "10",
    correct_answer: "",
    options: ["", "", "", ""],
    image_url: ""
  });
  const [uploadingImage, setUploadingImage] = useState(false);

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

    try {
      // Validate form data
      const validated = testSchema.parse({
        title: formData.title,
        description: formData.description || "",
        test_number: parseInt(formData.test_number),
        time_limit_minutes: formData.time_limit_minutes ? parseInt(formData.time_limit_minutes) : null,
        passing_score: parseInt(formData.passing_score)
      });

      const testData = {
        title: validated.title,
        description: validated.description || null,
        test_number: validated.test_number,
        time_limit_minutes: validated.time_limit_minutes,
        passing_score: validated.passing_score
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
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(editingTest ? "Failed to update test" : "Failed to create test");
      }
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

  const openQuestionManager = async (test: any) => {
    setSelectedTest(test);
    const fetchedQuestions = await fetchQuestions(test.id);
    
    // Auto-generate next question number
    const maxQuestionNumber = fetchedQuestions && fetchedQuestions.length > 0
      ? Math.max(...fetchedQuestions.map((q: any) => q.question_number))
      : 0;
    
    setQuestionForm({
      ...questionForm,
      question_number: (maxQuestionNumber + 1).toString()
    });
    
    setQuestionDialogOpen(true);
  };

  const fetchQuestions = async (testId: string) => {
    try {
      const { data, error } = await supabase
        .from("test_questions")
        .select("*")
        .eq("test_id", testId)
        .order("question_number", { ascending: true });

      if (error) throw error;
      setQuestions(data || []);
      return data || [];
    } catch (error) {
      toast.error("Failed to load questions");
      console.error(error);
      return [];
    }
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const filteredOptions = questionForm.options.filter(o => o.trim());
      
      // Validate form data
      const validated = questionSchema.parse({
        question_text: questionForm.question_text,
        question_type: questionForm.question_type,
        question_number: parseInt(questionForm.question_number),
        max_points: parseInt(questionForm.max_points),
        correct_answer: questionForm.correct_answer || "",
        options: questionForm.question_type === "mcq" ? filteredOptions : null,
        image_url: questionForm.image_url || ""
      });

      // Additional MCQ validation
      if (questionForm.question_type === "mcq") {
        validateMCQQuestion({
          question_type: questionForm.question_type,
          options: filteredOptions,
          correct_answer: questionForm.correct_answer
        });
      }

      const questionData = {
        test_id: selectedTest.id,
        question_text: validated.question_text,
        question_type: validated.question_type,
        question_number: validated.question_number,
        max_points: validated.max_points,
        correct_answer: validated.question_type === "mcq" ? validated.correct_answer : validated.correct_answer || null,
        options: validated.options,
        image_url: validated.image_url || null
      };

      if (editingQuestion) {
        const { error } = await supabase
          .from("test_questions")
          .update(questionData)
          .eq("id", editingQuestion.id);

        if (error) throw error;
        toast.success("Question updated successfully");
      } else {
        const { error } = await supabase
          .from("test_questions")
          .insert(questionData);

        if (error) throw error;
        toast.success("Question added successfully");
      }

      setEditingQuestion(null);
      
      // Auto-generate next question number after adding
      const updatedQuestions = await fetchQuestions(selectedTest.id);
      const maxQuestionNumber = updatedQuestions && updatedQuestions.length > 0
        ? Math.max(...updatedQuestions.map((q: any) => q.question_number))
        : 0;
      
      setQuestionForm({
        question_text: "",
        question_type: "mcq",
        question_number: (maxQuestionNumber + 1).toString(),
        max_points: "10",
        correct_answer: "",
        options: ["", "", "", ""],
        image_url: ""
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to save question");
      }
    }
  };

  const handleEditQuestion = (question: any) => {
    setEditingQuestion(question);
    setQuestionForm({
      question_text: question.question_text,
      question_type: question.question_type,
      question_number: question.question_number.toString(),
      max_points: question.max_points.toString(),
      correct_answer: question.correct_answer || "",
      options: question.question_type === "mcq" ? [...question.options, "", "", "", ""].slice(0, 4) : ["", "", "", ""],
      image_url: question.image_url || ""
    });
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const { error } = await supabase
        .from("test_questions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;
      toast.success("Question deleted successfully");
      fetchQuestions(selectedTest.id);
    } catch (error) {
      toast.error("Failed to delete question");
      console.error(error);
    }
  };

  const addOptionField = () => {
    setQuestionForm({
      ...questionForm,
      options: [...questionForm.options, ""]
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('question-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('question-images')
        .getPublicUrl(filePath);

      setQuestionForm({ ...questionForm, image_url: publicUrl });
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setQuestionForm({ ...questionForm, image_url: "" });
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
                          variant="default"
                          onClick={() => openQuestionManager(test)}
                        >
                          <FileQuestion className="h-4 w-4" />
                        </Button>
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

        <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Questions - {selectedTest?.title}</DialogTitle>
              <DialogDescription>
                Add and edit MCQ and text-based questions for this test
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{editingQuestion ? "Edit Question" : "Add New Question"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleQuestionSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="question_number">Question Number</Label>
                        <Input
                          id="question_number"
                          type="number"
                          value={questionForm.question_number}
                          onChange={(e) => setQuestionForm({ ...questionForm, question_number: e.target.value })}
                          placeholder="1"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max_points">Max Points</Label>
                        <Input
                          id="max_points"
                          type="number"
                          value={questionForm.max_points}
                          onChange={(e) => setQuestionForm({ ...questionForm, max_points: e.target.value })}
                          placeholder="10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="question_type">Question Type</Label>
                      <Select
                        value={questionForm.question_type}
                        onValueChange={(value: "mcq" | "text") => setQuestionForm({ 
                          ...questionForm, 
                          question_type: value,
                          options: value === "mcq" ? questionForm.options : ["", "", "", ""],
                          correct_answer: ""
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                          <SelectItem value="text">Text Answer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="question_text">Question Text</Label>
                      <Textarea
                        id="question_text"
                        value={questionForm.question_text}
                        onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                        placeholder="Enter the question..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="question_image">Question Image (Optional)</Label>
                      {questionForm.image_url ? (
                        <div className="space-y-2">
                          <img 
                            src={questionForm.image_url} 
                            alt="Question" 
                            className="max-w-full h-auto rounded-lg border max-h-64 object-contain"
                          />
                          <Button type="button" variant="outline" size="sm" onClick={removeImage}>
                            Remove Image
                          </Button>
                        </div>
                      ) : (
                        <Input
                          id="question_image"
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                        />
                      )}
                      {uploadingImage && <p className="text-sm text-muted-foreground">Uploading...</p>}
                    </div>

                    {questionForm.question_type === "mcq" ? (
                      <>
                        <div className="space-y-2">
                          <Label>Answer Options</Label>
                          {questionForm.options.map((option, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...questionForm.options];
                                  newOptions[index] = e.target.value;
                                  setQuestionForm({ ...questionForm, options: newOptions });
                                }}
                                placeholder={`Option ${index + 1}`}
                              />
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={questionForm.correct_answer === option}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setQuestionForm({ ...questionForm, correct_answer: option });
                                    }
                                  }}
                                />
                                <Label className="text-xs">Correct</Label>
                              </div>
                            </div>
                          ))}
                          <Button type="button" variant="outline" size="sm" onClick={addOptionField}>
                            <Plus className="h-4 w-4 mr-1" /> Add Option
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="correct_answer">Expected Answer (Optional)</Label>
                        <Textarea
                          id="correct_answer"
                          value={questionForm.correct_answer}
                          onChange={(e) => setQuestionForm({ ...questionForm, correct_answer: e.target.value })}
                          placeholder="Enter the expected answer for reference..."
                          rows={2}
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button type="submit">
                        {editingQuestion ? "Update Question" : "Add Question"}
                      </Button>
                      {editingQuestion && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setEditingQuestion(null);
                              setQuestionForm({
                                question_text: "",
                                question_type: "mcq",
                                question_number: "",
                                max_points: "10",
                                correct_answer: "",
                                options: ["", "", "", ""],
                                image_url: ""
                              });
                            }}
                          >
                            Cancel Edit
                          </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Existing Questions ({questions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {questions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No questions added yet. Add your first question above.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {questions.map((question) => (
                        <Card key={question.id}>
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">Q{question.question_number}</Badge>
                                  <Badge variant={question.question_type === "mcq" ? "default" : "secondary"}>
                                    {question.question_type === "mcq" ? "MCQ" : "Text"}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">{question.max_points} points</span>
                                </div>
                                <p className="font-medium mb-2">{question.question_text}</p>
                                {question.image_url && (
                                  <img 
                                    src={question.image_url} 
                                    alt="Question" 
                                    className="max-w-full h-auto rounded-lg border max-h-48 object-contain mb-2"
                                  />
                                )}
                                {question.question_type === "mcq" && question.options && (
                                  <ul className="space-y-1 ml-4">
                                    {question.options.map((opt: string, idx: number) => (
                                      <li key={idx} className={`text-sm ${opt === question.correct_answer ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                                        {opt === question.correct_answer && "✓ "}{opt}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {question.question_type === "text" && question.correct_answer && (
                                  <p className="text-sm text-muted-foreground mt-2">
                                    <span className="font-medium">Expected: </span>{question.correct_answer}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleEditQuestion(question)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDeleteQuestion(question.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default TestManagement;
