import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { AuthorLookup } from "./AuthorLookup";
import { RoleSelector } from "./RoleSelector";
import { VenueLookup } from "./VenueLookup";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernameRegex = /^[a-zA-Z0-9_]+$/;

const baseSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required"),
  username: z
    .string()
    .min(3, "Username must be between 3 and 30 characters")
    .max(30, "Username must be between 3 and 30 characters")
    .regex(
      usernameRegex,
      "Username can only contain letters, numbers, and underscores",
    ),
  email: z
    .string()
    .min(1, "Email is required")
    .regex(emailRegex, "Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string().min(1, "Please confirm your password"),
  phone_number: z.string().optional(),
  bio: z.string().optional(),
  orc_id: z.string().optional(),
  issn: z.string().optional(),
});

const roleAwareSchema = baseSchema.superRefine((data, context) => {
  if (data.password !== data.confirm_password) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirm_password"],
      message: "Passwords do not match",
    });
  }
});

function buildPayload(values) {
  const payload = {
    full_name: values.full_name.trim(),
    username: values.username.trim(),
    email: values.email.trim(),
    password: values.password,
  };

  const phone = values.phone_number?.trim();
  const bio = values.bio?.trim();

  if (phone) {
    payload.phone_number = phone;
  }

  if (bio) {
    payload.bio = bio;
  }

  return payload;
}

function buildSignupErrorMessage(error) {
  const apiMessage = error?.response?.data?.error;

  if (apiMessage) {
    return apiMessage;
  }

  return "Unable to create account. Please try again.";
}

function emptyFormValues() {
  return {
    full_name: "",
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    phone_number: "",
    bio: "",
    orc_id: "",
    issn: "",
  };
}

export function SignupForm() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [selectedRole, setSelectedRole] = useState("user");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [resolvedAuthor, setResolvedAuthor] = useState(null);
  const [resolvedVenue, setResolvedVenue] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(roleAwareSchema),
    defaultValues: emptyFormValues(),
  });

  const orcId = watch("orc_id");
  const issn = watch("issn");

  const canSubmit = useMemo(() => {
    if (selectedRole === "researcher") {
      return Boolean(resolvedAuthor?.id);
    }

    if (selectedRole === "venue_user") {
      return Boolean(resolvedVenue?.id && resolvedVenue?.is_claimed === false);
    }

    return true;
  }, [selectedRole, resolvedAuthor, resolvedVenue]);

  const handleRoleChange = (nextRole) => {
    setSelectedRole(nextRole);
    setResolvedAuthor(null);
    setResolvedVenue(null);
    setServerError("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    reset(emptyFormValues());
  };

  const onSubmit = async (values) => {
    setServerError("");

    if (selectedRole === "researcher" && !values.orc_id?.trim()) {
      setServerError("ORC ID is required before lookup.");
      return;
    }

    if (selectedRole === "venue_user" && !values.issn?.trim()) {
      setServerError("ISSN is required before lookup.");
      return;
    }

    if (selectedRole === "researcher" && !resolvedAuthor?.id) {
      setServerError(
        "Please complete a successful ORC ID lookup before signup.",
      );
      return;
    }

    if (
      selectedRole === "venue_user" &&
      (!resolvedVenue?.id || resolvedVenue?.is_claimed)
    ) {
      setServerError("Please complete a successful ISSN lookup before signup.");
      return;
    }

    try {
      const basePayload = buildPayload(values);
      let endpoint = "/users";
      let requestBody = basePayload;

      if (selectedRole === "researcher") {
        endpoint = "/researchers";
        requestBody = {
          ...basePayload,
          author_id: resolvedAuthor.id,
        };
      }

      if (selectedRole === "venue_user") {
        endpoint = "/venue-users";
        requestBody = {
          ...basePayload,
          venue_id: resolvedVenue.id,
        };
      }

      const response = await api.post(endpoint, requestBody);
      const { token, role, userId } = response.data;

      login(token, { userId, role });
      toast.success("Account created! Redirecting to dashboard...");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message = buildSignupErrorMessage(error);
      setServerError(message);
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <RoleSelector
        selectedRole={selectedRole}
        onChange={handleRoleChange}
        disabled={isSubmitting}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {selectedRole === "researcher" ? (
          <AuthorLookup
            value={orcId ?? ""}
            onChange={(value) => {
              setResolvedAuthor(null);
              setServerError("");
              reset(
                { ...watch(), orc_id: value },
                { keepErrors: true, keepDirty: true, keepTouched: true },
              );
            }}
            onLookupSuccess={(author) => {
              setResolvedAuthor(author);
              setServerError("");
            }}
            disabled={isSubmitting}
          />
        ) : null}

        {selectedRole === "venue_user" ? (
          <VenueLookup
            value={issn ?? ""}
            onChange={(value) => {
              setResolvedVenue(null);
              setServerError("");
              reset(
                { ...watch(), issn: value },
                { keepErrors: true, keepDirty: true, keepTouched: true },
              );
            }}
            onLookupSuccess={(venue) => {
              setResolvedVenue(venue);
              setServerError("");
            }}
            disabled={isSubmitting}
          />
        ) : null}

        <div>
          <label
            htmlFor="full_name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Full Name
          </label>
          <input
            id="full_name"
            type="text"
            {...register("full_name")}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Your full name"
          />
          {errors.full_name ? (
            <p className="mt-1 text-sm text-red-500">
              {errors.full_name.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="username"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            {...register("username")}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="username"
          />
          {errors.username ? (
            <p className="mt-1 text-sm text-red-500">
              {errors.username.message}
            </p>
          ) : null}
        </div>

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
              {...register("password")}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-12 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password ? (
            <p className="mt-1 text-sm text-red-500">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="confirm_password"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirm_password"
              type={showConfirmPassword ? "text" : "password"}
              {...register("confirm_password")}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-12 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Retype your password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.confirm_password ? (
            <p className="mt-1 text-sm text-red-500">
              {errors.confirm_password.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="phone_number"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Phone (optional)
          </label>
          <input
            id="phone_number"
            type="text"
            {...register("phone_number")}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Phone number"
          />
        </div>

        <div>
          <label
            htmlFor="bio"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Short bio (optional)
          </label>
          <textarea
            id="bio"
            rows={4}
            {...register("bio")}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Tell us a little about yourself"
          />
        </div>

        {serverError ? (
          <p className="text-sm text-red-500">{serverError}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !canSubmit}
          className="w-full rounded-lg bg-[#1a6eb5] px-6 py-2 font-semibold text-white transition-all hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>

        <p className="text-center text-sm text-gray-700">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-[#1a6eb5] hover:text-blue-800"
          >
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
