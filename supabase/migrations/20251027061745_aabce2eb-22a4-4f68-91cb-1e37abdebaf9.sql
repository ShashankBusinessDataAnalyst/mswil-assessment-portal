-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create app_role enum for role types
CREATE TYPE public.app_role AS ENUM ('admin', 'evaluator', 'manager', 'new_joinee');

-- Create test_status enum
CREATE TYPE public.test_status AS ENUM ('locked', 'available', 'in_progress', 'submitted', 'evaluated', 'graded');

-- Create question_type enum
CREATE TYPE public.question_type AS ENUM ('mcq', 'text');

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  department TEXT,
  cohort TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table (CRITICAL: separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Create tests table (10 fixed tests)
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_number INTEGER UNIQUE NOT NULL CHECK (test_number BETWEEN 1 AND 10),
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER NOT NULL DEFAULT 70,
  time_limit_minutes INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create test_questions table
CREATE TABLE public.test_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
  question_number INTEGER NOT NULL,
  question_type question_type NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB, -- For MCQ: array of options
  correct_answer TEXT, -- For MCQ: correct option
  max_points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(test_id, question_number)
);

-- Create test_attempts table
CREATE TABLE public.test_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
  status test_status NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  score INTEGER,
  passed BOOLEAN,
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, test_id)
);

-- Create test_responses table
CREATE TABLE public.test_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID REFERENCES public.test_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.test_questions(id) ON DELETE CASCADE NOT NULL,
  answer_text TEXT,
  points_awarded INTEGER DEFAULT 0,
  auto_scored BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

-- Create evaluations table
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID REFERENCES public.test_attempts(id) ON DELETE CASCADE NOT NULL,
  evaluator_id UUID REFERENCES auth.users(id) NOT NULL,
  response_id UUID REFERENCES public.test_responses(id) ON DELETE CASCADE NOT NULL,
  points_awarded INTEGER NOT NULL,
  feedback TEXT,
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_final BOOLEAN DEFAULT false
);

-- Create audit_logs table (tracks all score changes)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID REFERENCES public.test_attempts(id) ON DELETE CASCADE NOT NULL,
  response_id UUID REFERENCES public.test_responses(id),
  changed_by UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Evaluators can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'evaluator'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for tests
CREATE POLICY "All authenticated users can view tests"
  ON public.tests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage tests"
  ON public.tests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for test_questions
CREATE POLICY "All authenticated users can view questions"
  ON public.test_questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage questions"
  ON public.test_questions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for test_attempts
CREATE POLICY "Users can view their own attempts"
  ON public.test_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attempts"
  ON public.test_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts"
  ON public.test_attempts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Evaluators can view all attempts"
  ON public.test_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'evaluator'));

CREATE POLICY "Evaluators can update attempts"
  ON public.test_attempts FOR UPDATE
  USING (public.has_role(auth.uid(), 'evaluator'));

CREATE POLICY "Managers can view all attempts"
  ON public.test_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can manage all attempts"
  ON public.test_attempts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for test_responses
CREATE POLICY "Users can view their own responses"
  ON public.test_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.test_attempts
      WHERE test_attempts.id = attempt_id
      AND test_attempts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own responses"
  ON public.test_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.test_attempts
      WHERE test_attempts.id = attempt_id
      AND test_attempts.user_id = auth.uid()
    )
  );

CREATE POLICY "Evaluators can view all responses"
  ON public.test_responses FOR SELECT
  USING (public.has_role(auth.uid(), 'evaluator'));

CREATE POLICY "Evaluators can update responses"
  ON public.test_responses FOR UPDATE
  USING (public.has_role(auth.uid(), 'evaluator'));

CREATE POLICY "Admins can manage all responses"
  ON public.test_responses FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for evaluations
CREATE POLICY "Evaluators can manage evaluations"
  ON public.evaluations FOR ALL
  USING (public.has_role(auth.uid(), 'evaluator'));

CREATE POLICY "Managers can view evaluations"
  ON public.evaluations FOR SELECT
  USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can manage evaluations"
  ON public.evaluations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for audit_logs
CREATE POLICY "Managers can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Evaluators can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'evaluator'));

CREATE POLICY "Admins can manage audit logs"
  ON public.audit_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can create audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, employee_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'employee_id', 'EMP' || substr(NEW.id::text, 1, 8))
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tests_updated_at
  BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_test_responses_updated_at
  BEFORE UPDATE ON public.test_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();