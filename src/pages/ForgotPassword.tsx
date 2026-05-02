import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Button from "../components/ui/Button";
import FormInput from "../components/ui/FormInput";
import { showToast } from "../components/ui/Toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      showToast(resetError.message, "error");
    } else {
      showToast("Check your university email for a reset link.", "success");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <h1 className="mb-6 text-center text-2xl font-extrabold text-white">
          Forgot Password
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormInput
            id="email"
            label="University Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@uoguelph.ca"
            autoComplete="email"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Sending…" : "Send Reset Link"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Back to{" "}
          <Link to="/login" className="font-medium text-primary hover:text-primary-dark">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
