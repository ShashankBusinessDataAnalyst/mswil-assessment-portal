export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          attempt_id: string
          changed_by: string
          created_at: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          response_id: string | null
        }
        Insert: {
          action: string
          attempt_id: string
          changed_by: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          response_id?: string | null
        }
        Update: {
          action?: string
          attempt_id?: string
          changed_by?: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          response_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "test_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          attempt_id: string
          evaluated_at: string | null
          evaluator_id: string
          feedback: string | null
          id: string
          is_final: boolean | null
          points_awarded: number
          response_id: string
        }
        Insert: {
          attempt_id: string
          evaluated_at?: string | null
          evaluator_id: string
          feedback?: string | null
          id?: string
          is_final?: boolean | null
          points_awarded: number
          response_id: string
        }
        Update: {
          attempt_id?: string
          evaluated_at?: string | null
          evaluator_id?: string
          feedback?: string | null
          id?: string
          is_final?: boolean | null
          points_awarded?: number
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "test_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cohort: string | null
          created_at: string | null
          department: string | null
          employee_id: string
          full_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          cohort?: string | null
          created_at?: string | null
          department?: string | null
          employee_id: string
          full_name: string
          id: string
          updated_at?: string | null
        }
        Update: {
          cohort?: string | null
          created_at?: string | null
          department?: string | null
          employee_id?: string
          full_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          id: string
          is_locked: boolean | null
          locked_at: string | null
          locked_by: string | null
          passed: boolean | null
          score: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["test_status"]
          submitted_at: string | null
          test_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          passed?: boolean | null
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["test_status"]
          submitted_at?: string | null
          test_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          passed?: boolean | null
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["test_status"]
          submitted_at?: string | null
          test_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions: {
        Row: {
          correct_answer: string | null
          created_at: string | null
          id: string
          max_points: number
          options: Json | null
          question_number: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          test_id: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string | null
          id?: string
          max_points?: number
          options?: Json | null
          question_number: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          test_id: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string | null
          id?: string
          max_points?: number
          options?: Json | null
          question_number?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_responses: {
        Row: {
          answer_text: string | null
          attempt_id: string
          auto_scored: boolean | null
          created_at: string | null
          id: string
          points_awarded: number | null
          question_id: string
          updated_at: string | null
        }
        Insert: {
          answer_text?: string | null
          attempt_id: string
          auto_scored?: boolean | null
          created_at?: string | null
          id?: string
          points_awarded?: number | null
          question_id: string
          updated_at?: string | null
        }
        Update: {
          answer_text?: string | null
          attempt_id?: string
          auto_scored?: boolean | null
          created_at?: string | null
          id?: string
          points_awarded?: number | null
          question_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          passing_score: number
          test_number: number
          time_limit_minutes: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          passing_score?: number
          test_number: number
          time_limit_minutes?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          passing_score?: number
          test_number?: number
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "evaluator" | "manager" | "new_joinee"
      question_type: "mcq" | "text"
      test_status:
        | "locked"
        | "available"
        | "in_progress"
        | "submitted"
        | "evaluated"
        | "graded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "evaluator", "manager", "new_joinee"],
      question_type: ["mcq", "text"],
      test_status: [
        "locked",
        "available",
        "in_progress",
        "submitted",
        "evaluated",
        "graded",
      ],
    },
  },
} as const
