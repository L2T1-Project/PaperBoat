import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
});

function buildLoginErrorMessage(error) {
  const status = error?.response?.status;
  const apiMessage = error?.response?.data?.error;

  if (status === 429) {
    const retrySeconds = apiMessage?.match(/(\d+)\s*seconds?/i)?.[1];

    if (retrySeconds) {
      return `Too many attempts. Try again in ${retrySeconds} seconds.`;
    }
  }

  if (apiMessage) {
    return apiMessage;
  }

  return "Unable to login. Please try again.";
}

export function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values) => {
    setServerError("");

    try {
      const response = await api.post("/users/login", {
        email: values.email,
        password: values.password,
      });

      const { token, role, userId } = response.data;
      login(token, { userId, role });
      toast.success("Login successful");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message = buildLoginErrorMessage(error);
      setServerError(message);
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="you@example.com"
        />
        {errors.email ? (
          <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            {...register("password")}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-12 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  d="M3 3l18 18"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10.6 10.6a2 2 0 002.8 2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.5 5.2A10.8 10.8 0 0112 5c5.4 0 9.5 3.9 10.8 7-1 2.4-3.2 4.9-6.1 6.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.4 6.4C4.2 7.7 2.6 9.8 1.8 12c.5 1.3 1.4 2.7 2.5 3.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  d="M1.8 12C3.1 8.9 7.2 5 12 5s8.9 3.9 10.2 7c-1.3 3.1-5.4 7-10.2 7S3.1 15.1 1.8 12z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
        {errors.password ? (
          <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
        ) : null}
      </div>

      <div className="text-right">
        <a
          href="#"
          className="text-sm font-medium text-[#1a6eb5] hover:text-blue-800"
        >
          Forgot password?
        </a>
      </div>

      {serverError ? (
        <p className="text-sm text-red-500">{serverError}</p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-[#1a6eb5] px-6 py-2 font-semibold text-white transition-all hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Logging in..." : "Login"}
      </button>

      <p className="text-center text-sm text-gray-700">
        Do not have an account?{" "}
        <Link
          to="/signup"
          className="font-semibold text-[#1a6eb5] hover:text-blue-800"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
