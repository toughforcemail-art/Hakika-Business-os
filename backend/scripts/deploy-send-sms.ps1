$ErrorActionPreference = "Stop"
$projectRef = "upvupkuokinwqwsfxyxy"
$requiredSecrets = @(
  "AFRICASTALKING_USERNAME",
  "AFRICASTALKING_API_KEY",
  "AFRICASTALKING_ENVIRONMENT",
  "SEND_SMS_HOOK_SECRET"
)

Set-Location (Join-Path $PSScriptRoot "..")
$projectsJson = npx supabase projects list --output json | ConvertFrom-Json
if (-not ($projectsJson | Where-Object { $_.ref -eq $projectRef })) {
  throw "The authenticated Supabase account cannot see target project $projectRef. Log into its owning account before deploying."
}

$secretOutput = npx supabase secrets list --project-ref $projectRef | Out-String
foreach ($secret in $requiredSecrets) {
  if ($secretOutput -notmatch [regex]::Escape($secret)) { throw "Required remote secret name is missing: $secret" }
}

npx supabase functions deploy send-sms --project-ref $projectRef --no-verify-jwt
npx supabase functions list --project-ref $projectRef
Write-Host "Deployed target: https://$projectRef.supabase.co/functions/v1/send-sms"
