import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ThreadSidebar } from "@/components/chat/ThreadSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useThreads } from "@/hooks/useThreads";

export default function ChatPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { threads, createThread } = useThreads();

  useEffect(() => {
    if (threadId) {
      const exists = threads.some((t) => t.id === threadId);
      if (!exists && threads.length > 0) {
        navigate(`/c/${threads[0].id}`, { replace: true });
      }
      return;
    }
    // no thread in URL: pick most recent or create one
    if (threads.length > 0) {
      navigate(`/c/${threads[0].id}`, { replace: true });
    } else {
      const t = createThread();
      navigate(`/c/${t.id}`, { replace: true });
    }
  }, [threadId, threads, navigate, createThread]);

  const active = threadId ? threads.find((t) => t.id === threadId) : undefined;

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <ThreadSidebar />
      {active ? (
        <ChatWindow key={active.id} thread={active} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Carregando...
        </div>
      )}
    </div>
  );
}
