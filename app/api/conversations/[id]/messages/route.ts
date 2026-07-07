import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getConversationForSession,
  listMessages,
  sendMessage,
} from "@/lib/server/messages/service";
import { apiError, readJson, requireSession } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const conversation = await getConversationForSession(id, session);
  if (!conversation) {
    return apiError("not_found", "Conversa não encontrada.", 404);
  }

  const messages = await listMessages(id, session.sub);
  return NextResponse.json(messages);
}

const sendMessageInput = z.object({ content: z.string().min(1) });

export async function POST(request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const conversation = await getConversationForSession(id, session);
  if (!conversation) {
    return apiError("not_found", "Conversa não encontrada.", 404);
  }

  const parsed = sendMessageInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("invalid_input", "Mensagem vazia.", 400);
  }

  const message = await sendMessage(id, session.sub, parsed.data.content);
  return NextResponse.json(message, { status: 201 });
}
