import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, User, Calendar, Clock } from "lucide-react";

interface TestResponse {
  id: string;
  question_id: string;
  answer_text: string;
  points_awarded: number;
  test_questions: {
    question_text: string;
    question_number: number;
    question_type: string;
    max_points: number;
    correct_answer: string | null;
  };
}

interface AttemptDetails {
  id: string;
  user_id: string;
  test_id: string;
  submitted_at: string;
  started_at: string;
  status: string;
}

const EvaluatePage = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<AttemptDetails | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [test, setTest] = useState<any>(null);
  const [responses, setResponses] = useState<TestResponse[]>([]);
  const [scores, setScores] = useState<{ [key: string]: number }>({});
  const [feedback, setFeedback] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (attemptId) {
      fetchAttemptData();
    }
  }, [attemptId]);

  const fetchAttemptData = async () => {
    try {
      // Fetch attempt details
      const { data: attemptData, error: attemptError } = await supabase
        .from("test_attempts")
        .select("*")
        .eq("id", attemptId)
        .single();

      if (attemptError) throw attemptError;
      setAttempt(attemptData);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", attemptData.user_id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch test details
      const { data: testData, error: testError } = await supabase
        .from("tests")
        .select("*")
        .eq("id", attemptData.test_id)
        .single();

      if (testError) throw testError;
      setTest(testData);

      // Fetch responses with questions
      const { data: responsesData, error: responsesError } = await supabase
        .from("test_responses")
        .select(`
          id,
          question_id,
          answer_text,
          points_awarded,
          test_questions (
            question_text,
            question_number,
            question_type,
            max_points,
            correct_answer
          )
        `)
        .eq("attempt_id", attemptId)
        .order("test_questions(question_number)");

      if (responsesError) throw responsesError;

      setResponses(responsesData as any);
      
      // Initialize scores with existing points
      const initialScores: { [key: string]: number } = {};
      responsesData.forEach((r: any) => {
        initialScores[r.id] = r.points_awarded || 0;
      });
      setScores(initialScores);

    } catch (error) {
      console.error(error);
      toast.error("Failed to load evaluation data");
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (responseId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const response = responses.find(r => r.id === responseId);
    const maxPoints = response?.test_questions.max_points || 0;
    const clampedValue = Math.min(Math.max(0, numValue), maxPoints);
    setScores(prev => ({ ...prev, [responseId]: clampedValue }));
  };

  const handleFeedbackChange = (responseId: string, value: string) => {
    setFeedback(prev => ({ ...prev, [responseId]: value }));
  };

  const handleSaveEvaluation = async () => {
    if (!attempt) return;
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update each response with scores
      for (const response of responses) {
        const { error: updateError } = await supabase
          .from("test_responses")
          .update({ points_awarded: scores[response.id] || 0 })
          .eq("id", response.id);

        if (updateError) throw updateError;

        // Create evaluation record
        const { error: evalError } = await supabase
          .from("evaluations")
          .insert({
            response_id: response.id,
            attempt_id: attemptId,
            points_awarded: scores[response.id] || 0,
            feedback: feedback[response.id] || null,
            evaluator_id: user.id,
            is_final: true
          });

        if (evalError) throw evalError;
      }

      // Calculate total score
      const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
      const maxScore = responses.reduce((sum, r) => sum + r.test_questions.max_points, 0);
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      const passed = test ? percentage >= test.passing_score : false;

      // Update attempt status
      const { error: attemptError } = await supabase
        .from("test_attempts")
        .update({
          status: "evaluated",
          score: percentage,
          passed: passed
        })
        .eq("id", attemptId);

      if (attemptError) throw attemptError;

      toast.success("Evaluation saved successfully");
      navigate("/evaluator");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save evaluation");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Evaluate Test" role="evaluator">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading evaluation...</p>
        </div>
      </Layout>
    );
  }

  if (!attempt || !profile || !test) {
    return (
      <Layout title="Evaluate Test" role="evaluator">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Evaluation data not found</p>
          <Button onClick={() => navigate("/evaluator")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  const totalMaxPoints = responses.reduce((sum, r) => sum + r.test_questions.max_points, 0);
  const currentTotal = Object.values(scores).reduce((sum, score) => sum + score, 0);

  return (
    <Layout title="Evaluate Test" role="evaluator">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/evaluator")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleSaveEvaluation} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Evaluation"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{test.title}</CardTitle>
                <CardDescription>Test {test.test_number}</CardDescription>
              </div>
              <Badge variant="outline" className="text-lg">
                {currentTotal} / {totalMaxPoints} points
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{profile.full_name}</span>
                <Badge variant="secondary">{profile.employee_id}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Submitted: {new Date(attempt.submitted_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  Duration: {Math.round((new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 60000)} min
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {responses.map((response) => (
            <Card key={response.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Badge variant="outline" className="mb-2">
                      Question {response.test_questions.question_number}
                    </Badge>
                    <CardTitle className="text-lg">
                      {response.test_questions.question_text}
                    </CardTitle>
                    {response.test_questions.correct_answer && (
                      <CardDescription className="mt-2">
                        <span className="font-semibold">Correct Answer:</span>{" "}
                        {response.test_questions.correct_answer}
                      </CardDescription>
                    )}
                  </div>
                  <Badge>
                    {response.test_questions.question_type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Student's Answer:</Label>
                  <div className="mt-2 p-4 bg-muted rounded-md">
                    {response.answer_text || <span className="text-muted-foreground">No answer provided</span>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`score-${response.id}`}>
                      Points (Max: {response.test_questions.max_points})
                    </Label>
                    <Input
                      id={`score-${response.id}`}
                      type="number"
                      min="0"
                      max={response.test_questions.max_points}
                      value={scores[response.id] || 0}
                      onChange={(e) => handleScoreChange(response.id, e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`feedback-${response.id}`}>Feedback (Optional)</Label>
                  <Textarea
                    id={`feedback-${response.id}`}
                    placeholder="Add feedback for the student..."
                    value={feedback[response.id] || ""}
                    onChange={(e) => handleFeedbackChange(response.id, e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveEvaluation} disabled={saving} size="lg">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Evaluation"}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default EvaluatePage;
