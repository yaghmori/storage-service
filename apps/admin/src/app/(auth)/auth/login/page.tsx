"use client";

import { Suspense, useEffect } from "react";
import { LoginForm } from "@/features/auth/components/login-form";
import { useSearchParams } from "next/navigation";

function LoginPageContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    sessionStorage.removeItem("auth_redirecting");
  }, []);

  return <LoginForm returnUrl={searchParams.get("returnUrl") ?? undefined} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
