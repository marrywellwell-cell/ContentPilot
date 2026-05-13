import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Edit, Instagram, Check, X, Download } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { downloadImageViaServer } from "@/lib/downloadImage";

interface InstagramPreviewProps {
  slides: string[];
  caption: string;
  hashtags: string[];
  imageUrls?: string[];
  onRegenerate?: () => void;
  onUpdate?: (data: { slides: string[]; caption: string; hashtags: string[] }) => void;
}

export function InstagramPreview({
  slides,
  caption,
  hashtags,
  imageUrls,
  onRegenerate,
  onUpdate,
}: InstagramPreviewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSlides, setEditedSlides] = useState(slides);
  const [editedCaption, setEditedCaption] = useState(caption);
  const [editedHashtags, setEditedHashtags] = useState(hashtags.join(" "));
  const currentImageUrl = imageUrls?.[currentSlide];
  const currentSlideText = slides[currentSlide] || "";
  const isCoverSlide = currentSlide === 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const handleSave = () => {
    const hashtagArray = editedHashtags
      .split(/[\s,]+/)
      .map(tag => tag.replace(/^#/, "").trim())
      .filter(tag => tag.length > 0);
    
    onUpdate?.({
      slides: editedSlides,
      caption: editedCaption,
      hashtags: hashtagArray,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedSlides(slides);
    setEditedCaption(caption);
    setEditedHashtags(hashtags.join(" "));
    setIsEditing(false);
  };

  const handleEditToggle = () => {
    if (!isEditing) {
      setEditedSlides(slides);
      setEditedCaption(caption);
      setEditedHashtags(hashtags.join(" "));
    }
    setIsEditing(!isEditing);
  };

  const renderTextOnCanvas = async (
    imageUrl: string,
    text: string,
    isCover: boolean
  ): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const fontSize = isCover ? Math.floor(canvas.width / 10) : Math.floor(canvas.width / 12);
        ctx.font = `bold ${fontSize}px "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillStyle = '#ffffff';
        
        const maxWidth = canvas.width * 0.8;
        const words = text.split('');
        let lines: string[] = [];
        let currentLine = '';
        
        for (const char of words) {
          const testLine = currentLine + char;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = char;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }
        
        const lineHeight = fontSize * 1.3;
        const totalHeight = lines.length * lineHeight;
        const startY = (canvas.height - totalHeight) / 2 + fontSize / 2;
        
        lines.forEach((line, index) => {
          ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
        });
        
        // Add AI watermark at bottom right
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        const watermarkFontSize = Math.floor(canvas.width / 30);
        ctx.font = `${watermarkFontSize}px "Pretendard", "Noto Sans KR", sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText('AI 생성', canvas.width - 15, canvas.height - 10);
        
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      };
      
      img.onerror = () => {
        resolve(null);
      };
      
      img.src = imageUrl;
    });
  };

  const downloadImageWithText = async (
    imageUrl: string,
    text: string,
    filename: string,
    isCover: boolean
  ): Promise<boolean> => {
    try {
      const blob = await renderTextOnCanvas(imageUrl, text, isCover);
      if (!blob) {
        await downloadImageViaServer(imageUrl, filename);
        return true;
      }
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await downloadImageViaServer(dataUrl, filename);
      return true;
    } catch (error) {
      console.error('Image download failed:', error);
      return false;
    }
  };

  const handleDownloadCurrentImage = async () => {
    if (!currentImageUrl) {
      toast({
        title: "이미지 없음",
        description: "다운로드할 이미지가 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const success = await downloadImageWithText(
      currentImageUrl,
      currentSlideText,
      `instagram-slide-${currentSlide + 1}.png`,
      isCoverSlide
    );

    if (success) {
      toast({
        title: "다운로드 완료",
        description: `슬라이드 ${currentSlide + 1} 이미지가 다운로드되었습니다.`,
      });
    } else {
      toast({
        title: "다운로드 실패",
        description: "이미지 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAllImages = async () => {
    if (!imageUrls || imageUrls.length === 0) {
      toast({
        title: "이미지 없음",
        description: "다운로드할 이미지가 없습니다.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "다운로드 시작",
      description: `${imageUrls.length}개의 이미지를 다운로드합니다...`,
    });

    let successCount = 0;
    for (let i = 0; i < imageUrls.length; i++) {
      const success = await downloadImageWithText(
        imageUrls[i],
        slides[i] || "",
        `instagram-slide-${i + 1}.png`,
        i === 0
      );
      if (success) successCount++;
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    toast({
      title: "다운로드 완료",
      description: `${successCount}/${imageUrls.length}개의 이미지가 다운로드되었습니다.`,
    });
  };

  useEffect(() => {
    setEditedSlides(slides);
    setEditedCaption(caption);
    setEditedHashtags(hashtags.join(" "));
  }, [slides, caption, hashtags]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Instagram className="h-5 w-5 text-primary" />
          인스타그램 콘텐츠
        </CardTitle>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSave}
                data-testid="button-instagram-save"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                data-testid="button-instagram-cancel"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRegenerate}
                data-testid="button-instagram-regenerate"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEditToggle}
                data-testid="button-instagram-edit"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="aspect-square overflow-hidden rounded-md bg-muted relative group">
          {currentImageUrl ? (
            <>
              <img
                src={currentImageUrl}
                alt={`Instagram post slide ${currentSlide + 1}`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-6">
                <p 
                  className={`text-white text-center font-bold drop-shadow-lg ${
                    isCoverSlide 
                      ? 'text-lg sm:text-xl md:text-2xl' 
                      : 'text-base sm:text-lg md:text-xl'
                  }`}
                  style={{
                    textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                    maxWidth: '90%',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {currentSlideText}
                </p>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  onClick={handleDownloadCurrentImage}
                  data-testid="button-download-current"
                  className="bg-background/80 backdrop-blur-sm hover:bg-background"
                >
                  <Download className="h-4 w-4 mr-2" />
                  다운로드
                </Button>
              </div>
              <div className="absolute bottom-2 right-2">
                <span className="text-white/60 text-xs" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                  AI 생성
                </span>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Instagram className="mx-auto h-12 w-12 mb-2" />
                <p className="text-sm">이미지가 여기에 표시됩니다</p>
              </div>
            </div>
          )}
        </div>

        {slides.length > 0 && (
          <div className="space-y-3">
            {slides.length > 1 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  캐러셀 슬라이드 ({slides.length})
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {slides.map((_, index) => (
                    <Button
                      key={index}
                      variant={currentSlide === index ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentSlide(index)}
                      data-testid={`button-slide-${index}`}
                    >
                      {index + 1}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <div className="text-sm font-medium">슬라이드 텍스트</div>
              {isEditing ? (
                <Textarea
                  value={editedSlides[currentSlide]}
                  onChange={(e) => {
                    const newSlides = [...editedSlides];
                    newSlides[currentSlide] = e.target.value;
                    setEditedSlides(newSlides);
                  }}
                  className="text-sm resize-none"
                  rows={2}
                  data-testid="textarea-slide-content"
                />
              ) : (
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-sm font-medium text-foreground">{slides[currentSlide]}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm font-medium">캡션</div>
          {isEditing ? (
            <Textarea
              value={editedCaption}
              onChange={(e) => setEditedCaption(e.target.value)}
              className="text-sm resize-none"
              rows={4}
              data-testid="textarea-caption"
            />
          ) : (
            <div className="text-sm text-foreground whitespace-pre-wrap">
              {caption}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">해시태그</div>
          {isEditing ? (
            <Textarea
              value={editedHashtags}
              onChange={(e) => setEditedHashtags(e.target.value)}
              className="text-sm resize-none"
              rows={2}
              placeholder="해시태그를 공백으로 구분하여 입력"
              data-testid="textarea-hashtags"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {hashtags.map((tag, index) => (
                <Badge key={index} variant="secondary" data-testid={`hashtag-${index}`}>
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {imageUrls && imageUrls.length > 0 && (
          <div className="pt-4 border-t">
            <Button
              onClick={handleDownloadAllImages}
              variant="outline"
              className="w-full"
              data-testid="button-download-all"
            >
              <Download className="h-4 w-4 mr-2" />
              모든 이미지 다운로드 ({imageUrls.length}개)
            </Button>
          </div>
        )}
        
        <canvas ref={canvasRef} className="hidden" />
      </CardContent>
    </Card>
  );
}
