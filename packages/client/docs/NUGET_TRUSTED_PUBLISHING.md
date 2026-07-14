# Publish .NET SDK to nuget.org (Trusted Publishing)

No long-lived API key required. Full steps mirror email-service:

→ [Trusted Publishing on nuget.org](https://learn.microsoft.com/en-us/nuget/nuget-org/trusted-publishing)

## Quick setup

1. nuget.org → **Trusted Publishing** → policy:
   - Repository owner: `yaghmori`
   - Repository: `storage-service`
   - Workflow: `cd-main.yml` (filename only)
2. GitHub → Settings → Secrets and variables → Actions → **Variables** → `NUGET_USER` = nuget.org **username** (not email, not API key).
3. CD uses `permissions.id-token: write` + `NuGet/login@v1` → temp key → `dotnet nuget push`.

Private repos: one successful login within 7 days permanently activates the policy.

After it works, revoke any old nuget.org API keys / `NUGET_TOKEN`.
