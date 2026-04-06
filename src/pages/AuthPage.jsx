import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext.jsx";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

async function parseResponseJsonSafe(response) {
  const rawText = await response.text();
  if (!rawText || !rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function AuthPage() {
  const [mode, setMode] = useState("login");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const navigate = useNavigate();
  const { user, setUser } = useAppContext();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    reset();
    setAuthError("");
  }, [mode, reset]);

  const onSubmit = async (data) => {
    setAuthError("");
    setSubmitting(true);

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload =
        mode === "signup"
          ? {
              name: data.name?.trim(),
              email: data.email.trim(),
              password: data.password,
            }
          : {
              email: data.email.trim(),
              password: data.password,
            };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await parseResponseJsonSafe(response);

      if (!response.ok) {
        throw new Error(
          responseData?.message || `Authentication failed (${response.status}).`
        );
      }
      if (!responseData) {
        throw new Error("Backend returned an empty response.");
      }

      setUser(responseData.user);
      reset();
      navigate("/");
    } catch (error) {
      setAuthError(error.message || "Unable to complete authentication.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="px-4 pb-16 pt-28 md:px-8">
      <section className="mx-auto grid max-w-7xl gap-8 rounded-[2.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,59,59,0.08),rgba(255,255,255,0.02))] p-6 md:p-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <p className="text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
            Access Control
          </p>
          <h1 className="text-4xl font-semibold uppercase leading-tight md:text-6xl">
            Secure your verification workspace.
          </h1>
          <p className="max-w-xl text-base leading-8 text-white/65">
            Create an account once, store it in MongoDB, and come back later to
            log in with the same credentials. Once you are in, DeepTrust keeps
            your active profile nearby across refreshes on this browser.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className={mode === "login" ? "dt-button" : "dt-button-muted"}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === "signup" ? "dt-button" : "dt-button-muted"}
              onClick={() => setMode("signup")}
            >
              Signup
            </button>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-sm leading-7 text-white/68">
            {user ? `Hey ${user.name}, your account is active.` : "No active user yet. Create one or log back in."}
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-[2rem] border border-white/10 bg-black/20 p-6"
        >
          {mode === "signup" ? (
            <div className="mb-4">
              <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">
                Name
              </label>
              <input
                type="text"
                className="w-full rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/55"
                placeholder="Arun"
                {...register("name", {
                  required: mode === "signup" ? "Name is required." : false,
                  minLength: {
                    value: 2,
                    message: "Name should be at least 2 characters.",
                  },
                })}
              />
              {errors.name ? (
                <p className="mt-2 text-sm text-[var(--accent)]">{errors.name.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mb-4">
            <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/55"
              placeholder="operator@deeptrust.ai"
              {...register("email", {
                required: "Email is required.",
                pattern: {
                  value: /\S+@\S+\.\S+/,
                  message: "Enter a valid email address.",
                },
              })}
            />
            {errors.email ? (
              <p className="mt-2 text-sm text-[var(--accent)]">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="mb-6">
            <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/55"
              placeholder="********"
              {...register("password", {
                required: "Password is required.",
                minLength: {
                  value: 6,
                  message: "Use at least 6 characters.",
                },
              })}
            />
            {errors.password ? (
              <p className="mt-2 text-sm text-[var(--accent)]">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {authError ? (
            <p className="mb-4 text-sm text-[var(--accent)]">{authError}</p>
          ) : null}

          <button type="submit" className="dt-button w-full">
            {submitting
              ? mode === "login"
                ? "Signing In..."
                : "Creating Account..."
              : mode === "login"
                ? "Enter Workspace"
                : "Create Account"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default AuthPage;
