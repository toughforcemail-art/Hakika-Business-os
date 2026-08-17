# ImageKit security

Uploads must use server-issued short-lived ImageKit signatures. The private key is read only on the server. The endpoint returns a controlled `501` until ImageKit environment variables are configured; it never exposes the private key. Uploaded file paths must remain organization/application scoped and metadata must be persisted only after server-side authorization.
