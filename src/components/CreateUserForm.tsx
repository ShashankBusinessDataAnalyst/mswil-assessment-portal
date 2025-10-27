import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const createUserSchema = z.object({
  userId: z.string()
    .trim()
    .regex(/^MSWIL_\d{3}$/, "User ID must be in format MSWIL_XXX (e.g., MSWIL_001)"),
  fullName: z.string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be less than 100 characters")
    .regex(/^[a-zA-Z\s]+$/, "Full name can only contain letters and spaces"),
  employeeId: z.string()
    .trim()
    .max(50, "Employee ID must be less than 50 characters")
    .optional()
    .or(z.literal("")),
  email: z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters")
    .toLowerCase(),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  role: z.enum(["admin", "evaluator", "manager", "new_joinee"], {
    required_error: "Please select a role"
  })
});

const CreateUserForm = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    userId: "",
    fullName: "",
    employeeId: "",
    email: "",
    password: "",
    role: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);

    try {
      // Validate form data with Zod
      const validated = createUserSchema.parse(formData);

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          userId: validated.userId,
          email: validated.email,
          password: validated.password,
          fullName: validated.fullName,
          employeeId: validated.employeeId || undefined,
          role: validated.role
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(`User ${validated.fullName} created successfully`);
      setFormData({
        userId: "",
        fullName: "",
        employeeId: "",
        email: "",
        password: "",
        role: ""
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to create user");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New User</CardTitle>
        <CardDescription>
          Add a new user to the system with a role assignment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userId">User ID (Login)</Label>
            <Input
              id="userId"
              value={formData.userId}
              onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
              placeholder="e.g., MSWIL_001"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Enter full name"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="employeeId">Employee ID (Optional)</Label>
            <Input
              id="employeeId"
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              placeholder="Enter employee ID (auto-generated if empty)"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@company.local"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Min 8 chars with upper, lower, number & special char"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Must contain: uppercase, lowercase, number, and special character
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => setFormData({ ...formData, role: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="evaluator">Evaluator</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="new_joinee">New Joinee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating User...
              </>
            ) : (
              "Create User"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateUserForm;
