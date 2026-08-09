"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { InvitesEndpoints, replacePathParams } from "@/lib/constants/endpoints";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { useAuth } from "@/provider/auth-provider";
import { Button, Input, Label, Spinner } from "@workspace/ui/components";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { InvitePreview } from "../hooks/use-members-queries";

export function AcceptInviteView({ token }: { token: string }) {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await upstream.get(
          replacePathParams(InvitesEndpoints.Preview, token),
        );
        const data = unwrapApiData<InvitePreview>(response.data);
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Invitation not found",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: password || undefined,
          name: name || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to accept invitation");
      }
      await refreshSession();
      toast.success(`Joined ${preview?.org.name ?? "organization"}`);
      router.replace(PAGE_ROUTES.home(preview!.org.slug));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Invitation unavailable</h1>
        <p className="text-sm text-muted-foreground">
          {error || "This invitation link is invalid or has already been used."}
        </p>
        <Button asChild variant="outline">
          <Link href={PAGE_ROUTES.AUTH.LOGIN}>Go to login</Link>
        </Button>
      </div>
    );
  }

  const signedInMatch =
    user?.email?.toLowerCase() === preview.email.toLowerCase();

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Join {preview.org.name}</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ve been invited as <strong>{preview.role}</strong> (
          {preview.email}).
        </p>
      </div>

      {signedInMatch ? (
        <Button className="w-full" disabled={submitting} onClick={accept}>
          {submitting ? "Joining…" : "Accept invitation"}
        </Button>
      ) : (
        <div className="space-y-4">
          {user ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Signed in as {user.email}, but this invite is for {preview.email}.
              Sign out or continue with the invite email password below.
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="invite-name">Name (optional)</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-password">Password</Label>
            <Input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create or enter your password"
            />
            <p className="text-xs text-muted-foreground">
              New accounts need a password (min 8 characters). Existing accounts
              should enter their current password.
            </p>
          </div>
          <Button
            className="w-full"
            disabled={submitting || password.length < 8}
            onClick={accept}
          >
            {submitting ? "Joining…" : "Accept & continue"}
          </Button>
        </div>
      )}
    </div>
  );
}
