import { ChatThread } from "@/components/chat/chat-thread";

export const dynamic = "force-dynamic";

export default function ChatPage({ params }: { params: { id: string } }) {
  return <ChatThread key={params.id} id={params.id} />;
}
