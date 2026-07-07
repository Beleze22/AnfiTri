import { ConversationList } from "@/components/manager/ConversationList";

export default function MensagensPage() {
  return (
    <>
      <ConversationList />
      <div className="hidden flex-1 items-center justify-center text-body text-text-secondary md:flex">
        Selecione uma conversa.
      </div>
    </>
  );
}
