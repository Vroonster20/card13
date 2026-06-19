// ─────────────────────────────────────────────
// src/components/auth/RegisterForm.tsx
// ─────────────────────────────────────────────
"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Registration failed');
        return;
      }

      // Auto sign-in
      await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="text-3xl font-bold text-white">Join Card 13</h1>
          <p className="text-green-400 text-sm mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-green-900/60 border border-green-700 rounded-2xl p-6 backdrop-blur space-y-4">
          {(['name', 'email', 'password', 'confirm'] as const).map(field => (
            <div key={field} className="space-y-2">
              <Label htmlFor={field} className="text-green-300 text-sm capitalize">
                {field === 'confirm' ? 'Confirm Password' : field}
              </Label>
              <Input
                id={field}
                type={field === 'name' || field === 'email' ? field : 'password'}
                placeholder={
                  field === 'name' ? 'Your name' :
                  field === 'email' ? 'you@example.com' : '••••••••'
                }
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="bg-green-950 border-green-700 text-white placeholder:text-green-700 focus:border-green-500"
              />
            </div>
          ))}

          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Account
          </Button>

          <p className="text-center text-sm text-green-500">
            Have an account?{' '}
            <Link href="/login" className="text-green-300 hover:text-white underline">
              Sign In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}