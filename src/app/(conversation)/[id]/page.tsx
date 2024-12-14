"use client";

import Conversation from "@/components/conversation";
import { use, useEffect } from "react";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  useEffect(() => {
    console.log(id);
  }, []);

  //   const directMessage = useQuery(api.functions.dm.get, { id });
  //   if (!directMessage) {
  //     return null;
  //   }

  return <Conversation />;
}
