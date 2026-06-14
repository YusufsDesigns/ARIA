// Quiet placeholder during the brief route segment load — no spinner, just a
// dark surface so the transition into the chat page feels instant.
export default function Loading() {
  return <div className="min-h-full bg-[#070707]" />
}
