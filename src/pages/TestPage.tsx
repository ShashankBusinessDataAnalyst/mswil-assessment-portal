import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Clock, CheckCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Test {
  id: string;
  title: string;
  description: string;
  time_limit_minutes: number | null;
}

interface Question {
  id: string;
  question_number: number;
  question_text: string;
  question_type: string;
  options: any;
  max_points: number;
  image_url?: string | null;
}

interface Answer {
  question_id: string;
  answer_text: string;
}

const TestPage = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  useEffect(() => {
    if (testId) {
      initializeTest();
    }
  }, [testId]);

  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  const initializeTest = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to take the test");
        navigate("/auth");
        return;
      }

      // Fetch test details
      const { data: testData, error: testError } = await supabase
        .from("tests")
        .select("*")
        .eq("id", testId)
        .single();

      if (testError) throw testError;
      setTest(testData);

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("test_questions")
        .select("*")
        .eq("test_id", testId)
        .order("question_number");

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // Check for existing attempt
      const { data: existingAttempt } = await supabase
        .from("test_attempts")
        .select("*")
        .eq("test_id", testId)
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .maybeSingle();

      if (existingAttempt) {
        setAttemptId(existingAttempt.id);
        // Load existing responses
        const { data: responses } = await supabase
          .from("test_responses")
          .select("*")
          .eq("attempt_id", existingAttempt.id);

        if (responses) {
          const answersMap: Record<string, string> = {};
          responses.forEach((r) => {
            answersMap[r.question_id] = r.answer_text || "";
          });
          setAnswers(answersMap);
        }

        // Calculate time remaining if time limit exists
        if (testData.time_limit_minutes) {
          const startedAt = new Date(existingAttempt.started_at).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - startedAt) / 1000);
          const total = testData.time_limit_minutes * 60;
          setTimeRemaining(Math.max(0, total - elapsed));
        }
      } else {
        // Create new attempt
        const { data: newAttempt, error: attemptError } = await supabase
          .from("test_attempts")
          .insert({
            user_id: user.id,
            test_id: testId,
            status: "in_progress",
          })
          .select()
          .single();

        if (attemptError) throw attemptError;
        setAttemptId(newAttempt.id);

        if (testData.time_limit_minutes) {
          setTimeRemaining(testData.time_limit_minutes * 60);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load test");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = async (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

    // Auto-save answer
    if (attemptId) {
      try {
        const { data: existing } = await supabase
          .from("test_responses")
          .select("id")
          .eq("attempt_id", attemptId)
          .eq("question_id", questionId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("test_responses")
            .update({ answer_text: value })
            .eq("id", existing.id);
        } else {
          await supabase.from("test_responses").insert({
            attempt_id: attemptId,
            question_id: questionId,
            answer_text: value,
          });
        }
      } catch (error) {
        console.error("Error saving answer:", error);
      }
    }
  };

  const handleAutoSubmit = async () => {
    toast.info("Time's up! Submitting test automatically...");
    await submitTest();
  };

  const submitTest = async () => {
    if (!attemptId) return;

    setSubmitting(true);
    try {
      // Update attempt status
      await supabase
        .from("test_attempts")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", attemptId);

      toast.success("Test submitted successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit test");
    } finally {
      setSubmitting(false);
      setShowSubmitDialog(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).filter((k) => answers[k]).length;

  if (loading) {
    return (
      <Layout title="Test" role="new_joinee">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading test...</p>
        </div>
      </Layout>
    );
  }

  if (!test || questions.length === 0) {
    return (
      <Layout title="Test" role="new_joinee">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Test not found or has no questions</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4 mx-auto block">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout title={test.title} role="new_joinee">
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header with timer and progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-lg font-semibold">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
              {timeRemaining !== null && (
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className={`text-lg font-mono font-semibold ${timeRemaining < 60 ? "text-destructive" : ""}`}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              )}
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Answered: {answeredCount} / {questions.length}
            </p>
          </CardContent>
        </Card>

        {/* Question Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Question {currentQuestion.question_number}</CardTitle>
            <CardDescription>{currentQuestion.max_points} points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-lg whitespace-pre-line">
              {currentQuestion.question_text.split('|').map((text: string, index: number) => (
                <span key={index}>
                  {text.trim()}
                  {index < currentQuestion.question_text.split('|').length - 1 && '  '}
                </span>
              ))}
            </p>

            {currentQuestion.image_url && (
              <div className="rounded-lg border overflow-hidden bg-muted/30">
                <img 
                  src={currentQuestion.image_url} 
                  alt="Question illustration" 
                  className="max-w-full h-auto max-h-96 object-contain mx-auto"
                />
              </div>
            )}

            {currentQuestion.question_type === "mcq" && currentQuestion.options ? (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
              >
                {currentQuestion.options.map((option, idx) => (
                  <div key={idx} className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent">
                    <RadioGroupItem value={option} id={`option-${idx}`} />
                    <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <Textarea
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                placeholder="Type your answer here..."
                className="min-h-[200px]"
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>

          <div className="flex gap-2">
            {currentQuestionIndex < questions.length - 1 ? (
              <Button onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}>
                Next Question
              </Button>
            ) : (
              <Button onClick={() => setShowSubmitDialog(true)} disabled={submitting}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Submit Test
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Test?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} out of {questions.length} questions.
              {answeredCount < questions.length && " Unanswered questions will be marked as incomplete."}
              <br />
              <br />
              Are you sure you want to submit your test? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Answers</AlertDialogCancel>
            <AlertDialogAction onClick={submitTest}>Submit Test</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default TestPage;
