import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAppContext } from "../context/AppContext.jsx";

function AuthPage() {
  const [mode, setMode] = useState("login");
  const { setUser } = useAppContext();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const onSubmit = (data) => {
    setUser({
      name: data.name || "DeepTrust User",
      email: data.email,
    });
    reset();
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
            Switch between login and signup states with a sleek dual-mode auth
            panel. This demo stores the active user in shared context.
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
                placeholder="Agent name"
                {...register("name", {
                  required: mode === "signup" ? "Name is required." : false,
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

          <button type="submit" className="dt-button w-full">
            {mode === "login" ? "Enter Workspace" : "Create Account"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default AuthPage;
