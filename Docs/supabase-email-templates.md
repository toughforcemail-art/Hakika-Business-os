# Supabase email templates

These templates are designed for the Supabase Auth email-template editor. Set the project Site URL and additional redirect URLs to the deployed Hakika origin. The application handles confirmation links at `/auth/confirm` and password updates at `/auth/update-password`.

Use the supplied Supabase variables only; never put service-role keys, passwords, or tokens in a template.

## Invite user

Subject: `You have been invited to Hakika Business OS`

```html
<h2>You are invited to Hakika Business OS</h2>
<p>You have been invited to join Hakika Business OS.</p>
<p><a href="{{ .ConfirmationURL }}">Accept invitation</a></p>
<p>If you did not expect this invitation, you can ignore this email.</p>
```

## Reset password

Subject: `Reset your Hakika password`

```html
<h2>Reset your password</h2>
<p>Use the button below to choose a new Hakika password.</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
<p>If you did not request this, you can ignore this email.</p>
```

## Confirm signup

Subject: `Confirm your Hakika account`

```html
<h2>Confirm your Hakika account</h2>
<p><a href="{{ .ConfirmationURL }}">Confirm email address</a></p>
```

## Magic link / OTP

Subject: `Your Hakika sign-in link`

```html
<h2>Sign in to Hakika</h2>
<p><a href="{{ .ConfirmationURL }}">Sign in securely</a></p>
<p>Or enter this one-time code: <strong>{{ .Token }}</strong></p>
```

## Change email

Subject: `Confirm your new Hakika email address`

```html
<h2>Confirm your new email address</h2>
<p><a href="{{ .ConfirmationURL }}">Confirm email change</a></p>
```

## Reauthentication

Subject: `Confirm your Hakika identity`

```html
<h2>Confirm your identity</h2>
<p>Enter this one-time code in Hakika:</p>
<p><strong>{{ .Token }}</strong></p>
```

## Security notifications

For password changed, email changed, phone changed, and verification method added or removed notifications, use a plain notification without an action link:

Subject: `Hakika account security notification`

```html
<h2>Hakika account security notification</h2>
<p>A security setting on your account was changed.</p>
<p>If you did not make this change, contact your organization administrator immediately.</p>
```

Before enabling a template in production, send a test message from the Supabase dashboard and confirm that the link resolves to the configured Site URL, then `/auth/confirm`. Do not claim delivery or link behavior is verified until that test is completed.
