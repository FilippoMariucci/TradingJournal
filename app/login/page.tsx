"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Credenziali errate");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-[#1e293b] p-6 rounded-xl max-w-sm w-full shadow-xl">

        <h1 className="text-2xl font-bold text-center mb-4">Login</h1>

        {error && <p className="text-red-500 text-center mb-2">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 rounded bg-slate-800 border border-slate-600 mb-3"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 rounded bg-slate-800 border border-slate-600 mb-4"
        />

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded text-white font-semibold"
        >
          Accedi
        </button>

        <p className="text-slate-400 text-xs text-center mt-4">
          L’accesso è facoltativo.  
          Puoi continuare ad usare il sito anche senza login.
        </p>
      </div>
    </div>
  );
}
