import { ConversationList } from "@/components/manager/ConversationList";

export default function MensagensPage() {
  return (
    <>
      <ConversationList />
      <div className="flex flex-1 items-center justify-center text-body text-text-secondary">
        Selecione uma conversa.
      </div>
    </>
  );
}
