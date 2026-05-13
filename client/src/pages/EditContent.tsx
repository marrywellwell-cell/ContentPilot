import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { InstagramPreview } from "@/components/InstagramPreview";
import { BlogPreview } from "@/components/BlogPreview";
import { ScheduleDialog } from "@/components/ScheduleDialog";
import { ContentChatEditor } from "@/components/ContentChatEditor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, MessageSquare, ArrowLeft, Save } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ContentSet } from "@shared/schema";
import { Link } from "wouter";

interface GeneratedContent {
  keyword: string;
  platforms: string[];
  instagramSlides?: string[];
  instagramCaption?: string;
  instagramHashtags?: string[];
  instagramImageUrls?: string[];
  blogTitle?: string;
  blogContent?: string;
  blogMetaDescription?: string;
  blogHtml?: string;
  blogImageUrls?: string[];
}

export default function EditContent() {
  const [, params] = useRoute("/edit/:id");
  const contentSetId = params?.id;
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const { toast } = useToast();

  // Fetch the content set
  const { data: contentSet, isLoading } = useQuery<ContentSet>({
    queryKey: ["/api/content-sets", contentSetId],
    enabled: !!contentSetId,
  });

  // Sync generatedContent with contentSet
  useEffect(() => {
    if (contentSet) {
      setGeneratedContent({
        keyword: contentSet.keyword,
        platforms: contentSet.platforms || [],
        instagramSlides: contentSet.instagramSlides || undefined,
        instagramCaption: contentSet.instagramCaption || undefined,
        instagramHashtags: contentSet.instagramHashtags || undefined,
        instagramImageUrls: contentSet.instagramImageUrls || undefined,
        blogTitle: contentSet.blogTitle || undefined,
        blogContent: contentSet.blogContent || undefined,
        blogMetaDescription: contentSet.blogMetaDescription || undefined,
        blogHtml: contentSet.blogHtml || undefined,
        blogImageUrls: contentSet.blogImageUrls || undefined,
      });
    }
  }, [contentSet]);

  const updateContentMutation = useMutation({
    mutationFn: async (updates: Partial<ContentSet>) => {
      const response = await apiRequest(`/api/content-sets/${contentSetId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-sets", contentSetId] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-sets"] });
      toast({
        title: "저장 완료",
        description: "콘텐츠가 성공적으로 저장되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "저장 실패",
        description: error.message || "콘텐츠 저장에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const scheduleContentMutation = useMutation({
    mutationFn: async ({ scheduledDate, platforms }: any) => {
      const response = await apiRequest(`/api/content-sets/${contentSetId}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduledDate, platforms }),
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-sets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-sets", contentSetId] });
      setScheduleOpen(false);
      toast({
        title: "예약 완료!",
        description: `${new Date(data.scheduledDate).toLocaleDateString("ko-KR")} ${new Date(data.scheduledDate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}에 발행됩니다.`,
      });
    },
  });

  const handleInstagramUpdate = (data: { slides: string[]; caption: string; hashtags: string[] }) => {
    if (!contentSetId) return;
    
    const updates = {
      instagramSlides: data.slides,
      instagramCaption: data.caption,
      instagramHashtags: data.hashtags,
    };
    
    updateContentMutation.mutate(updates);
    
    setGeneratedContent((prev) => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });
  };

  const handleSchedule = (date: Date, platforms: string[]) => {
    if (!contentSetId) return;
    
    scheduleContentMutation.mutate({
      scheduledDate: date.toISOString(),
      platforms: platforms,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">콘텐츠를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!contentSet || !generatedContent) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">콘텐츠를 찾을 수 없습니다.</p>
          <Link href="/dashboard">
            <Button variant="outline" data-testid="button-back-dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              대시보드로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold" data-testid="text-page-title">
              콘텐츠 편집
            </h1>
            <p className="text-muted-foreground mt-1">
              키워드: {generatedContent.keyword}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setScheduleOpen(true)}
            disabled={!generatedContent}
            data-testid="button-schedule"
          >
            <FileText className="w-4 h-4 mr-2" />
            예약하기
          </Button>
        </div>
      </div>

      <Tabs defaultValue="preview" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="preview" data-testid="tab-preview">
            <FileText className="w-4 h-4 mr-2" />
            미리보기
          </TabsTrigger>
          <TabsTrigger value="ai-edit" data-testid="tab-ai-edit">
            <MessageSquare className="w-4 h-4 mr-2" />
            AI 편집
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="space-y-6 mt-6">
          {generatedContent.platforms.includes("instagram") && generatedContent.instagramSlides && (
            <div>
              <h2 className="text-xl font-semibold mb-4">인스타그램</h2>
              <InstagramPreview
                slides={generatedContent.instagramSlides}
                caption={generatedContent.instagramCaption || ""}
                hashtags={generatedContent.instagramHashtags || []}
                imageUrls={generatedContent.instagramImageUrls || []}
                onUpdate={handleInstagramUpdate}
              />
            </div>
          )}

          {generatedContent.platforms.includes("blog") && generatedContent.blogHtml && (
            <div>
              <h2 className="text-xl font-semibold mb-4">블로그</h2>
              <BlogPreview
                title={generatedContent.blogTitle || ""}
                content={generatedContent.blogHtml}
                metaDescription={generatedContent.blogMetaDescription || ""}
                imageUrls={generatedContent.blogImageUrls}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai-edit" className="mt-6">
          {contentSetId && (
            <ContentChatEditor contentSetId={contentSetId} />
          )}
        </TabsContent>
      </Tabs>

      {generatedContent && (
        <ScheduleDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          platforms={generatedContent.platforms}
          onSchedule={handleSchedule}
        />
      )}
    </div>
  );
}
