"use client";

import Conversation from "@/components/conversation";
import { use } from "react";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <Conversation id={id} />;
}
