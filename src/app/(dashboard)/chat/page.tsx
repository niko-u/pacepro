import { requireOnboarding } from "@/lib/auth/require-onboarding";
import ChatClient from "./chat-client";

export const metadata = {
  title: "Chat with Coach",
};

export default async function ChatPage() {
  const user = await requireOnboarding();
  return <ChatClient user={user} />;
}
