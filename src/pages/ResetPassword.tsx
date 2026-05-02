import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Button from "../components/ui/Button";
import FormInput from "../components/ui/FormInput";
import { showToast } from "../components/ui/Toast";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      showToast(updateError.message, "error");
      return;
    }

    showToast("Password updated successfully.", "success");
    navigate("/login");
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <h1 className="mb-6 text-center text-2xl font-extrabold text-white">
          Reset Password
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormInput
            id="newPassword"
            label="New Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            hint="Must be at least 6 characters"
          />
          <FormInput
            id="confirmPassword"
            label="Confirm Password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
