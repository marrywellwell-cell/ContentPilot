import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Instagram, FileText, Calendar, BarChart2 } from "lucide-react";

interface LandingProps {
  onLogin: () => void;
}

export default function Landing({ onLogin }: LandingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-screen gap-12">
        <div className="text-center space-y-6 max-w-3xl">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-12 h-12 text-primary" />
            <h1 className="text-5xl font-bold tracking-tight">ContentFlow</h1>
          </div>
          
          <p className="text-xl text-muted-foreground">
            AI 기반 콘텐츠 자동화 플랫폼으로 인스타그램 캐러셀과 블로그 콘텐츠를 손쉽게 생성하세요
          </p>
          
          <Button 
            size="lg" 
            onClick={onLogin}
            className="text-lg px-8 py-6"
            data-testid="button-login"
          >
            로그인하여 시작하기
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl">
          <Card className="hover-elevate">
            <CardHeader>
              <Instagram className="w-10 h-10 text-pink-500 mb-2" />
              <CardTitle className="text-lg">인스타그램 캐러셀</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                눈길을 사로잡는 캐러셀 포스트를 AI가 자동으로 생성합니다
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <FileText className="w-10 h-10 text-blue-500 mb-2" />
              <CardTitle className="text-lg">SEO 블로그</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                검색 최적화된 블로그 콘텐츠를 인포그래픽과 함께 생성합니다
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Calendar className="w-10 h-10 text-green-500 mb-2" />
              <CardTitle className="text-lg">스케줄링</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                비주얼 캘린더로 콘텐츠 발행 일정을 쉽게 관리하세요
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <BarChart2 className="w-10 h-10 text-orange-500 mb-2" />
              <CardTitle className="text-lg">분석</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                콘텐츠 성과를 한눈에 확인하고 최적화하세요
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <p className="text-sm text-muted-foreground">
          Google, GitHub, Apple, X 또는 이메일로 로그인할 수 있습니다
        </p>
      </div>
    </div>
  );
}
