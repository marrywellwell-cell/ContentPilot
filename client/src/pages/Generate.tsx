import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { KeywordInput } from "@/components/KeywordInput";
import { InstagramPreview } from "@/components/InstagramPreview";
import { BlogPreview } from "@/components/BlogPreview";
import { ScheduleDialog } from "@/components/ScheduleDialog";
import { ContentChatEditor } from "@/components/ContentChatEditor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, MessageSquare } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ContentSet } from "@shared/schema";

interface ImageRecommendation {
  description: string;
  altText: string;
}

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
  blogTitles?: string[];
  blogThumbnailTexts?: string[];
  blogImageRecommendations?: ImageRecommendation[];
  blogInternalLinkTopics?: string[];
  blogHashtags?: string[];
}

export default function Generate() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [savedContentSetId, setSavedContentSetId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(searchString);
  const initialKeyword = urlParams.get("keyword") || "";
  
  useEffect(() => {
    if (initialKeyword) {
      navigate("/", { replace: true });
    }
  }, []);

  // Fetch saved content set to keep chat in sync
  const { data: savedContentSet } = useQuery<ContentSet>({
    queryKey: ["/api/content-sets", savedContentSetId],
    enabled: !!savedContentSetId,
  });

  // Sync generatedContent with savedContentSet when it changes (e.g., after chat edits)
  useEffect(() => {
    if (savedContentSet) {
      setGeneratedContent({
        keyword: savedContentSet.keyword,
        platforms: savedContentSet.platforms || [],
        instagramSlides: savedContentSet.instagramSlides || undefined,
        instagramCaption: savedContentSet.instagramCaption || undefined,
        instagramHashtags: savedContentSet.instagramHashtags || undefined,
        instagramImageUrls: savedContentSet.instagramImageUrls || undefined,
        blogTitle: savedContentSet.blogTitle || undefined,
        blogContent: savedContentSet.blogContent || undefined,
        blogMetaDescription: savedContentSet.blogMetaDescription || undefined,
        blogHtml: savedContentSet.blogHtml || undefined,
        blogImageUrls: savedContentSet.blogImageUrls || undefined,
        blogTitles: savedContentSet.blogTitles || undefined,
        blogThumbnailTexts: savedContentSet.blogThumbnailTexts || undefined,
        blogImageRecommendations: (savedContentSet.blogImageRecommendations as ImageRecommendation[]) || undefined,
        blogInternalLinkTopics: savedContentSet.blogInternalLinkTopics || undefined,
        blogHashtags: savedContentSet.blogHashtags || undefined,
      });
    }
  }, [savedContentSet]);

  const generateMutation = useMutation({
    mutationFn: async ({ keyword, platforms, brandAnalysisId }: { keyword: string; platforms: string[]; brandAnalysisId?: string }) => {
      const response = await apiRequest("/api/content/generate", {
        method: "POST",
        body: JSON.stringify({ keyword, platforms, brandAnalysisId }),
      });
      return response as GeneratedContent;
    },
    onSuccess: async (data) => {
      setGeneratedContent(data);
      
      // Auto-save content set as draft
      const saved = await saveContentMutation.mutateAsync({
        keyword: data.keyword,
        platforms: data.platforms,
        instagramSlides: data.instagramSlides,
        instagramCaption: data.instagramCaption,
        instagramHashtags: data.instagramHashtags,
        instagramImageUrls: data.instagramImageUrls,
        blogTitle: data.blogTitle,
        blogContent: data.blogContent,
        blogMetaDescription: data.blogMetaDescription,
        blogHtml: data.blogHtml,
        blogImageUrls: data.blogImageUrls,
        blogTitles: data.blogTitles,
        blogThumbnailTexts: data.blogThumbnailTexts,
        blogImageRecommendations: data.blogImageRecommendations,
        blogInternalLinkTopics: data.blogInternalLinkTopics,
        blogHashtags: data.blogHashtags,
        status: "draft",
      });
      
      setSavedContentSetId((saved as any).id);
      
      toast({
        title: "콘텐츠 생성 완료!",
        description: "아래에서 콘텐츠를 검토하고 AI로 수정할 수 있습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "생성 실패",
        description: error.message || "콘텐츠 생성에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const saveContentMutation = useMutation({
    mutationFn: async (contentSet: any) => {
      const response = await apiRequest("/api/content-sets", {
        method: "POST",
        body: JSON.stringify(contentSet),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-sets"] });
    },
  });

  const scheduleContentMutation = useMutation({
    mutationFn: async ({ contentSetId, scheduledDate, platforms }: any) => {
      const response = await apiRequest(`/api/content-sets/${contentSetId}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduledDate, platforms }),
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-sets"] });
      toast({
        title: "스케줄 등록 완료!",
        description: `콘텐츠가 ${new Date(data.scheduledDate).toLocaleDateString('ko-KR')}에 발행됩니다.`,
      });
      setScheduleOpen(false);
    },
  });

  const handleGenerate = (keyword: string, platforms: string[], brandAnalysisId?: string) => {
    generateMutation.mutate({ keyword, platforms, brandAnalysisId });
  };

  const handleSchedule = async (date: Date, platforms: string[]) => {
    if (!savedContentSetId) return;

    // Schedule the already-saved content set
    scheduleContentMutation.mutate({
      contentSetId: savedContentSetId,
      scheduledDate: date.toISOString(),
      platforms,
    });
  };

  const handleRegenerate = () => {
    if (generatedContent) {
      generateMutation.mutate({
        keyword: generatedContent.keyword,
        platforms: generatedContent.platforms,
      });
    }
  };

  const handleInstagramUpdate = (data: { slides: string[]; caption: string; hashtags: string[] }) => {
    if (generatedContent) {
      setGeneratedContent({
        ...generatedContent,
        instagramSlides: data.slides,
        instagramCaption: data.caption,
        instagramHashtags: data.hashtags,
      });
      toast({
        title: "수정 완료",
        description: "인스타그램 콘텐츠가 업데이트되었습니다.",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          콘텐츠 생성
        </h1>
        <p className="text-muted-foreground mt-1">
          인스타그램과 블로그를 위한 AI 기반 콘텐츠 생성
        </p>
      </div>

      {!generatedContent ? (
        <div className="max-w-2xl mx-auto">
          <KeywordInput onGenerate={handleGenerate} isLoading={generateMutation.isPending} initialKeyword={initialKeyword} />
          {generateMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                AI로 콘텐츠를 생성하는 중...
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {generatedContent.platforms.includes("instagram") && (
                  <InstagramPreview
                    slides={generatedContent.instagramSlides || []}
                    caption={generatedContent.instagramCaption || ""}
                    hashtags={generatedContent.instagramHashtags || []}
                    imageUrls={generatedContent.instagramImageUrls}
                    onRegenerate={handleRegenerate}
                    onUpdate={handleInstagramUpdate}
                  />
                )}
                {generatedContent.platforms.includes("blog") && (
                  <BlogPreview
                    title={generatedContent.blogTitle || ""}
                    content={generatedContent.blogHtml || ""}
                    metaDescription={generatedContent.blogMetaDescription || ""}
                    imageUrls={generatedContent.blogImageUrls}
                    titles={generatedContent.blogTitles}
                    thumbnailTexts={generatedContent.blogThumbnailTexts}
                    imageRecommendations={generatedContent.blogImageRecommendations}
                    internalLinkTopics={generatedContent.blogInternalLinkTopics}
                    hashtags={generatedContent.blogHashtags}
                    onRegenerate={handleRegenerate}
                    onEdit={() => console.log("Edit Blog")}
                  />
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-4">
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">AI 편집</h3>
                  </div>
                  <div className="h-[600px]">
                    {savedContentSetId ? (
                      <ContentChatEditor contentSetId={savedContentSetId} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p className="text-sm text-center">콘텐츠를 먼저 생성해주세요.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setGeneratedContent(null);
                setSavedContentSetId(null);
              }}
              data-testid="button-generate-new"
            >
              새로 생성
            </Button>
            <Button onClick={() => setScheduleOpen(true)} data-testid="button-schedule-content">
              스케줄 등록
            </Button>
          </div>
        </div>
      )}

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        platforms={generatedContent?.platforms || []}
        onSchedule={handleSchedule}
      />
    </div>
  );
}
