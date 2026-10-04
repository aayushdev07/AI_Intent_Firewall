import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold text-fog">Not found</h1>
      <p className="mt-2 text-sm text-fog-dim">This run, intent or page does not exist.</p>
      <Link href="/chat" className="mt-4 inline-block text-sm text-signal hover:underline">Back to chat</Link>
    </div>
  );
}
