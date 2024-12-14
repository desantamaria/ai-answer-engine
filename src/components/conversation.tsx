"use client";

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { Message } from "@/app/utils/chat";
import { v4 as uuidv4 } from "uuid";
import { MsgScrollArea } from "@/components/msg-scroll-area";
import { useRouter } from "next/navigation";

export default function Conversation({ id }: { id?: string }) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState("");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "system", content: "Hello! How can I help you today?" },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (id) {
      setConversationId(id);
    }
  }, []);

  const handleSend = async () => {
    if (!message.trim()) return;

    // Add user message to the conversation
    const userMessage = { role: "user" as const, content: message };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
          context: updatedMessages,
          conversationId: conversationId || uuidv4(),
        }),
      });
      const responseJson = await response.json();

      setMessages(prev => [...prev, responseJson]);
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [
        ...prev,
        {
          role: "system",
          content: "Sorry, there was an error processing your message.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // TODO: Modify the color schemes, fonts, and UI as needed for a good user experience
  // Refer to the Tailwind CSS docs here: https://tailwindcss.com/docs/customizing-colors, and here: https://tailwindcss.com/docs/hover-focus-and-other-states
  return (
    <div className="flex flex-col h-screen bg-[#0C041A]">
      {/* Header */}
      <div className="w-full bg-[#250D3A] border-b border-violet-700 p-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-white">AI Chat Engine</h1>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto pb-32 pt-4">
        <div className="max-w-3xl mx-auto px-4">
          <MsgScrollArea scrollToBottom={messages && messages.length > 0}>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-4 mb-4 ${
                  msg.role === "system"
                    ? "justify-start"
                    : "justify-end flex-row-reverse"
                }`}
              >
                <div
                  className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                    msg.role === "system"
                      ? "border border-violet-700 text-gray-100"
                      : "bg-violet-600 text-white ml-auto"
                  }`}
                >
                  <Markdown
                    components={{
                      a: ({ node, ...props }) => (
                        <a
                          {...props}
                          className="text-violet-400 hover:text-violet-300 underline hover:no-underline transition-colors duration-200"
                        />
                      ),
                    }}
                  >
                    {msg.content}
                  </Markdown>
                </div>
              </div>
            ))}
          </MsgScrollArea>
          {isLoading && (
            <div className="flex gap-4 mb-4">
              <div className="w-8 h-8 rounded-full bg-violet-800 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-violet-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-8c.79 0 1.5-.71 1.5-1.5S8.79 9 8 9s-1.5.71-1.5 1.5S7.21 11 8 11zm8 0c.79 0 1.5-.71 1.5-1.5S16.79 9 16 9s-1.5.71-1.5 1.5.71 1.5 1.5 1.5zm-4 4c2.21 0 4-1.79 4-4h-8c0 2.21 1.79 4 4 4z" />
                </svg>
              </div>
              <div className="px-4 py-2 rounded-2xl border border-violet-700 text-gray-100">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 w-full bg-[#250D3A] border-t border-violet-700 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-center">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyUp={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  handleSend();
                } else if (e.key === "Enter" && e.shiftKey) {
                  e.preventDefault();
                }
              }}
              placeholder="Type your message..."
              className="flex-1 rounded-xl border border-violet-700 bg-[#0C041A] px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder-gray-400 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="bg-purple-600 text-white px-5 py-3 rounded-xl hover:bg-purple-700 transition-all disabled:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
