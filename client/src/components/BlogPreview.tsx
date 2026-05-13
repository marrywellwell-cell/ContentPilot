import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Edit, FileText, ExternalLink, Copy, Download, Hash, Link, Image, Type } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { downloadImageViaServer } from "@/lib/downloadImage";

interface ImageRecommendation {
  description: string;
  altText: string;
}

interface BlogPreviewProps {
  title: string;
  content: string;
  metaDescription: string;
  imageUrls?: string[];
  titles?: string[];
  thumbnailTexts?: string[];
  imageRecommendations?: ImageRecommendation[];
  internalLinkTopics?: string[];
  hashtags?: string[];
  onRegenerate?: () => void;
  onEdit?: () => void;
}

function extractImageUrls(htmlContent: string): string[] {
  const imgRegex = /<img[^>]+src="([^">]+)"/g;
  const matches = Array.from(htmlContent.matchAll(imgRegex));
  return matches.map(match => match[1]).filter(url => url.startsWith('http'));
}

export function BlogPreview({
  title,
  content,
  metaDescription,
  imageUrls,
  titles,
  thumbnailTexts,
  imageRecommendations,
  internalLinkTopics,
  hashtags,
  onRegenerate,
  onEdit,
}: BlogPreviewProps) {
  const { toast } = useToast();
  const [downloadingImages, setDownloadingImages] = useState<Set<number>>(new Set());

  const extractedImageUrls = imageUrls || extractImageUrls(content);

  const handleDownloadImage = async (imageUrl: string, index: number) => {
    try {
      setDownloadingImages(prev => new Set(prev).add(index));

      await downloadImageViaServer(imageUrl, `blog-image-${index + 1}.png`);

      toast({
        title: "다운로드 완료",
        description: `이미지 ${index + 1}이(가) 다운로드되었습니다.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "다운로드 실패",
        description: "이미지 다운로드에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setDownloadingImages(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleDownloadAllImages = async () => {
    for (let i = 0; i < extractedImageUrls.length; i++) {
      await handleDownloadImage(extractedImageUrls[i], i);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const handleCopyHTML = async () => {
    try {
      // HTML을 순수 텍스트로 변환
      let plainText = content
        // 이미지 태그를 [이미지] 플레이스홀더로 대체
        .replace(/<img[^>]*>/g, '\n\n[이미지]\n\n')
        // H2 태그를 제목 형식으로 변환 (앞뒤 줄바꿈)
        .replace(/<h2[^>]*>(.*?)<\/h2>/g, '\n\n$1\n')
        // P 태그를 줄바꿈으로 변환
        .replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n')
        // 기타 HTML 태그 모두 제거
        .replace(/<[^>]+>/g, '')
        // HTML 엔티티 디코딩
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // 연속된 줄바꿈을 최대 2개로 제한
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // 제목과 본문을 함께 구성
      const fullText = `${title}\n\n${plainText}`;

      await navigator.clipboard.writeText(fullText);
      
      toast({
        title: "복사 완료",
        description: extractedImageUrls.length > 0
          ? "텍스트가 복사되었습니다. 이미지는 아래 버튼으로 다운로드해서 네이버 블로그에 업로드하세요."
          : "텍스트가 복사되었습니다.",
      });
    } catch (error) {
      console.error('Copy error:', error);
      toast({
        title: "복사 실패",
        description: "복사에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  const handleOpenInNewWindow = () => {
    const newWindow = window.open("", "_blank", "width=900,height=800");
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="description" content="${metaDescription.replace(/"/g, '&quot;')}">
          <title>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem;
              color: #1a1a1a;
              background: #ffffff;
            }
            h1 {
              font-size: 2.5rem;
              font-weight: 700;
              margin-bottom: 1rem;
              color: #1a1a1a;
            }
            h2 {
              font-size: 1.75rem;
              font-weight: 700;
              margin-top: 2.5rem;
              margin-bottom: 1rem;
              color: #1a1a1a;
            }
            p {
              margin-bottom: 1rem;
              color: #374151;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
            }
            @media print {
              body {
                max-width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <h1>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
          ${content}
        </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          블로그 콘텐츠
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyHTML}
            data-testid="button-blog-copy-html"
            title="HTML 복사"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenInNewWindow}
            data-testid="button-blog-open-new-window"
            title="새 창에서 보기"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRegenerate}
            data-testid="button-blog-regenerate"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            data-testid="button-blog-edit"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">제목</div>
          <h3 className="text-xl font-semibold" data-testid="text-blog-title">
            {title}
          </h3>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            메타 설명
          </div>
          <p className="text-sm text-foreground">{metaDescription}</p>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">콘텐츠 미리보기</div>
          <ScrollArea className="h-96 rounded-md border p-4">
            <div className="prose prose-sm max-w-none">
              <div
                dangerouslySetInnerHTML={{ __html: content }}
                data-testid="text-blog-content"
              />
            </div>
          </ScrollArea>
        </div>

        <Accordion type="multiple" className="w-full" defaultValue={["titles", "thumbnails", "hashtags"]}>
          {titles && titles.length > 0 && (
            <AccordionItem value="titles">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  제목 옵션 ({titles.length}개)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {titles.map((t, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-md bg-muted/50 text-sm cursor-pointer hover-elevate"
                      onClick={() => {
                        navigator.clipboard.writeText(t);
                        toast({ title: "복사 완료", description: `제목 ${i + 1}이 복사되었습니다.` });
                      }}
                      data-testid={`text-blog-title-option-${i}`}
                    >
                      {i + 1}. {t}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {thumbnailTexts && thumbnailTexts.length > 0 && (
            <AccordionItem value="thumbnails">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  썸네일 문구 ({thumbnailTexts.length}개)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {thumbnailTexts.map((text, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(text);
                        toast({ title: "복사 완료", description: "썸네일 문구가 복사되었습니다." });
                      }}
                      data-testid={`badge-thumbnail-text-${i}`}
                    >
                      {text}
                    </Badge>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {imageRecommendations && imageRecommendations.length > 0 && (
            <AccordionItem value="images">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  이미지 추천 ({imageRecommendations.length}개)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {imageRecommendations.map((rec, i) => (
                    <div key={i} className="p-3 rounded-md bg-muted/50 space-y-1">
                      <div className="text-sm font-medium">{i + 1}. {rec.description}</div>
                      <div className="text-xs text-muted-foreground">Alt: {rec.altText}</div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {internalLinkTopics && internalLinkTopics.length > 0 && (
            <AccordionItem value="links">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  내부 링크 주제 ({internalLinkTopics.length}개)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {internalLinkTopics.map((topic, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(topic);
                        toast({ title: "복사 완료", description: "주제가 복사되었습니다." });
                      }}
                      data-testid={`badge-internal-link-${i}`}
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {hashtags && hashtags.length > 0 && (
            <AccordionItem value="hashtags">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  해시태그 ({hashtags.length}개)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {hashtags.map((tag, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(`#${tag}`);
                        toast({ title: "복사 완료", description: "해시태그가 복사되었습니다." });
                      }}
                      data-testid={`badge-hashtag-${i}`}
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    const allTags = hashtags.map(t => `#${t}`).join(' ');
                    navigator.clipboard.writeText(allTags);
                    toast({ title: "복사 완료", description: "모든 해시태그가 복사되었습니다." });
                  }}
                  data-testid="button-copy-all-hashtags"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  전체 복사
                </Button>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {extractedImageUrls.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              블로그 이미지 ({extractedImageUrls.length}개)
            </div>
            <div className="flex flex-wrap gap-2">
              {extractedImageUrls.map((url, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadImage(url, index)}
                  disabled={downloadingImages.has(index)}
                  data-testid={`button-download-blog-image-${index}`}
                >
                  <Download className="h-3 w-3 mr-1" />
                  {downloadingImages.has(index) ? "다운로드 중..." : `이미지 ${index + 1}`}
                </Button>
              ))}
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadAllImages}
                disabled={downloadingImages.size > 0}
                data-testid="button-download-all-blog-images"
              >
                <Download className="h-3 w-3 mr-1" />
                전체 다운로드
              </Button>
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <Button
            onClick={handleCopyHTML}
            variant="outline"
            className="w-full"
            data-testid="button-copy-html-full"
          >
            <Copy className="h-4 w-4 mr-2" />
            텍스트만 복사 (네이버 블로그용)
          </Button>
          {extractedImageUrls.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              이미지는 위 버튼으로 다운로드 후 네이버 블로그에 직접 업로드하세요
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
