"use client";

export default function NotesPage({ moduleScope = "finance" }: { moduleScope?: string }) {
  return <section className="rounded-xl border bg-white p-6"><h1 className="text-2xl font-bold">Notes</h1><textarea className="mt-4 min-h-48 w-full rounded-lg border p-3" data-module={moduleScope} placeholder="Write a note…" /></section>;
}
