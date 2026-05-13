import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage, ChatResponse } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

interface ContentChatEditorProps {
  contentSetId: string;
}

export function ContentChatEditor({ contentSetId }: ContentChatEditorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest(
        `/api/content-sets/${contentSetId}/chat`,
        {
          method: "POST",
          body: JSON.stringify({
            message,
            conversationHistory: messages,
          }),
        }
      );
      return response as ChatResponse;
    },
    onSuccess: (data) => {
      // Add assistant response to messages
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Invalidate and refetch content set query to refresh the preview
      queryClient.invalidateQueries({ 
        queryKey: ["/api/content-sets", contentSetId],
        refetchType: 'active'
      });
      
      // Force refetch to ensure latest data
      queryClient.refetchQueries({ 
        queryKey: ["/api/content-sets", contentSetId]
      });

      // Show success toast if content was updated
      if (data.updatedContent && Object.keys(data.updatedContent).length > 0) {
        toast({
          title: "콘텐츠가 업데이트되었습니다",
          description: "변경 사항이 미리보기에 반영되었습니다.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "오류가 발생했습니다",
        description: error.message,
      });
    },
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim() || chatMutation.isPending) return;

    // Add user message to messages
    const userMessage: ChatMessage = {
      role: "user",
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Send to API
    chatMutation.mutate(inputMessage);

    // Clear input
    setInputMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b">
        <Sparkles className="w-5 h-5 text-primary" data-testid="icon-sparkles" />
        <h3 className="font-semibold">AI 콘텐츠 편집</h3>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Sparkles className="w-12 h-12 mb-4 opacity-50" data-testid="icon-empty-state" />
            <p className="text-sm">
              AI에게 콘텐츠 수정을 요청해보세요.
            </p>
            <p className="text-xs mt-2">
              예: "인스타그램 캡션을 더 짧게 만들어줘", "블로그 제목을 바꿔줘"
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.role}-${idx}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" data-testid="icon-loading" />
                    <p className="text-sm text-muted-foreground">AI가 작성 중...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            data-testid="input-chat-message"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
            className="resize-none min-h-[60px]"
            disabled={chatMutation.isPending}
          />
          <Button
            data-testid="button-send-message"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || chatMutation.isPending}
            size="icon"
            className="min-h-[60px]"
          >
            {chatMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Enter로 전송, Shift+Enter로 줄바꿈
        </p>
      </div>
    </Card>
  );
}
