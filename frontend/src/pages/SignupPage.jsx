import { SignupForm } from "../components/auth/SignupForm";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-white text-gray-700">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-2">
        <div className="flex flex-col justify-center bg-linear-to-br from-[#1a6eb5] to-[#00a8a8] p-8 text-white sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.22em]">
            PaperBoat
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            Join the community shaping tomorrow&apos;s research
          </h1>
          <p className="mt-4 max-w-md text-sm text-blue-50 sm:text-base">
            Build your profile, collaborate with peers, and showcase the impact
            of your work.
          </p>
        </div>

        <div className="flex items-center justify-center bg-gray-100 p-6 sm:p-10">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
            <h2 className="text-2xl font-semibold text-gray-800">
              Create account
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Get started with PaperBoat
            </p>
            <div className="mt-6">
              <SignupForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
