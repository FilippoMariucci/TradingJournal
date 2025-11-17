"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: any) {
    e.preventDefault();
    setError("");

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (res?.error) {
      setError("Credenziali errate");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] text-white">
      <form
        onSubmit={handleLogin}
        className="bg-[#1f2937] p-8 rounded-xl w-80 space-y-4 border border-neutral-700"
      >
        <h1 className="text-3xl font-bold text-center mb-4">Login</h1>

        {error && (
          <p className="text-red-500 text-center text-sm">{error}</p>
        )}

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 bg-neutral-800 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 bg-neutral-800 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded"
        >
          Accedi
        </button>
      </form>
    </div>
  );
}
