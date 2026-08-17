"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ idle, pending }: { idle: string; pending: string }) { const { pending: isPending } = useFormStatus(); return <button className="button primary" type="submit" disabled={isPending}>{isPending ? pending : idle}</button>; }
