# Action mapping

Mutation actions are intentionally unimplemented. Each future action must map to a server action/service, permission, audit event, validation contract and failure state.
# Vertical slice action mapping

Create/update property and unit actions authenticate through the canonical application access path, derive tenant context server-side, validate input, call a repository, record an audit event, and redirect to the created/updated record. Unit asset create follows the same contract. Archive is represented by archive fields and hard delete is revoked.
