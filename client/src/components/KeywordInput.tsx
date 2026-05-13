import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Target } from "lucide-react";
import type { BrandAnalysis } from "@shared/schema";

interface KeywordInputProps {
  onGenerate: (keyword: string, platforms: string[], brandAnalysisId?: string) => void;
  isLoading?: boolean;
  initialKeyword?: string;
}

export function KeywordInput({ onGenerate, isLoading, initialKeyword }: KeywordInputProps) {
  const [keyword, setKeyword] = useState(initialKeyword || "");
  
  useEffect(() => {
    if (initialKeyword) {
      setKeyword(initialKeyword);
    }
  }, [initialKeyword]);
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "blog"]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");

  const { data: brandAnalyses } = useQuery<BrandAnalysis[]>({
    queryKey: ["/api/brand-analyses"],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim() && platforms.length > 0) {
      // Only pass brandAnalysisId if a valid brand is selected (not empty or "none")
      const brandId = selectedBrandId && selectedBrandId !== "none" ? selectedBrandId : undefined;
      onGenerate(keyword, platforms, brandId);
    }
  };

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="keyword" className="text-lg font-medium">
          주제 또는 키워드 입력
        </Label>
        <Input
          id="keyword"
          placeholder="예: 건강한 아침 식사 레시피, 디지털 마케팅 팁..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="text-base"
          data-testid="input-keyword"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-base font-medium">브랜드 분석 (선택)</Label>
        <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
          <SelectTrigger data-testid="select-brand-analysis">
            <Target className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="브랜드를 선택하세요 (선택사항)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">브랜드 선택 안함</SelectItem>
            {brandAnalyses?.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.brandName} - {brand.productService}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          브랜드를 선택하면 분석 결과를 기반으로 맞춤 콘텐츠가 생성됩니다
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">플랫폼 선택</Label>
        <div className="flex gap-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="instagram"
              checked={platforms.includes("instagram")}
              onCheckedChange={() => togglePlatform("instagram")}
              data-testid="checkbox-instagram"
            />
            <label
              htmlFor="instagram"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Instagram
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="blog"
              checked={platforms.includes("blog")}
              onCheckedChange={() => togglePlatform("blog")}
              data-testid="checkbox-blog"
            />
            <label
              htmlFor="blog"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              블로그
            </label>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isLoading || !keyword.trim() || platforms.length === 0}
        className="w-full"
        data-testid="button-generate"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {isLoading ? "생성 중..." : "콘텐츠 생성"}
      </Button>
    </form>
  );
}
