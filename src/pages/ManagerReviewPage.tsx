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
import { ArrowLeft, Save, User, Calendar, Clock, CheckCircle2, XCircle, Sparkles, Eye, EyeOff, AlertCircle } from "lucide-react";

interface TestResponse {
  id: string;
  question_id: string;
  answer_text: string;
  points_awarded: number;
  auto_scored: boolean;
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
  passed: boolean;
}

const ManagerReviewPage = () => {
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
  const [showAllQuestions, setShowAllQuestions] = useState(true);

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
          auto_scored,
          test_questions (
            question_text,
            question_number,
            question_type,
            max_points,
            correct_answer
          )
        `)
        .eq("attempt_id", attemptId);

      if (responsesError) throw responsesError;

      // Sort responses by question number
      const sortedResponses = (responsesData as any[]).sort((a, b) => {
        return (a.test_questions?.question_number || 0) - (b.test_questions?.question_number || 0);
      });

      setResponses(sortedResponses);
      
      // Initialize scores with existing points
      const initialScores: { [key: string]: number } = {};
      sortedResponses.forEach((r: any) => {
        initialScores[r.id] = r.points_awarded || 0;
      });
      setScores(initialScores);

    } catch (error) {
      console.error(error);
      toast.error("Failed to load test data");
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

      toast.success("Re-evaluation saved successfully");
      navigate("/manager");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save re-evaluation");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Review & Re-evaluate Test" role="manager">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading test data...</p>
        </div>
      </Layout>
    );
  }

  if (!attempt || !profile || !test) {
    return (
      <Layout title="Review & Re-evaluate Test" role="manager">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Test data not found</p>
          <Button onClick={() => navigate("/manager")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  // Filter responses to show only those answered incorrectly
  const questionsAnsweredWrong = responses.filter(response => {
    const maxPoints = response.test_questions.max_points;
    const awarded = response.points_awarded || 0;
    // Show if points awarded is less than max points (answered incorrectly)
    return awarded < maxPoints;
  });

  const displayedResponses = showAllQuestions ? responses : questionsAnsweredWrong;
  const totalMaxPoints = responses.reduce((sum, r) => sum + r.test_questions.max_points, 0);
  const currentTotal = Object.values(scores).reduce((sum, score) => sum + score, 0);

  return (
    <Layout title="Review & Re-evaluate Test" role="manager">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/manager")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            {!attempt.passed && (
              <Badge variant="destructive" className="gap-2 py-2 px-4">
                <AlertCircle className="h-4 w-4" />
                Failed Test
              </Badge>
            )}
            <Button 
              variant="outline" 
              onClick={() => setShowAllQuestions(!showAllQuestions)}
            >
              {showAllQuestions ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showAllQuestions ? "Show Only Wrong Answers" : "Show All Questions"}
            </Button>
            <Button onClick={handleSaveEvaluation} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Re-evaluation"}
            </Button>
          </div>
        </div>

        {!showAllQuestions && (
          <Card className="bg-amber-500/10 border-amber-500">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    Reviewing {questionsAnsweredWrong.length} question{questionsAnsweredWrong.length !== 1 ? 's' : ''} answered incorrectly
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {responses.length - questionsAnsweredWrong.length} question{responses.length - questionsAnsweredWrong.length !== 1 ? 's' : ''} answered correctly {responses.length - questionsAnsweredWrong.length > 0 ? '(hidden)' : ''}
                  </p>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {questionsAnsweredWrong.length} / {responses.length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

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
          {displayedResponses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
                <p className="text-lg font-medium mb-2">All questions answered correctly!</p>
                <p className="text-sm text-muted-foreground mb-4">
                  There are no incorrect answers to review.
                </p>
                <Button variant="outline" onClick={() => setShowAllQuestions(true)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View All Questions
                </Button>
              </CardContent>
            </Card>
          ) : (
            displayedResponses.map((response) => (
            <Card key={response.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">
                        Question {response.test_questions.question_number}
                      </Badge>
                      {response.auto_scored && (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          Auto-scored
                        </Badge>
                      )}
                    </div>
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
                  <div className="flex items-center gap-2">
                    <Badge>
                      {response.test_questions.question_type}
                    </Badge>
                    {response.auto_scored && response.test_questions.question_type === "mcq" && (
                      response.answer_text?.trim() === response.test_questions.correct_answer?.trim() ? (
                        <Badge variant="default" className="bg-green-500 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Correct
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Incorrect
                        </Badge>
                      )
                    )}
                  </div>
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
                      {response.auto_scored && (
                        <span className="text-xs text-muted-foreground ml-2">(Auto-scored, editable)</span>
                      )}
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
            ))
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveEvaluation} disabled={saving} size="lg">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Re-evaluation"}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default ManagerReviewPage;
