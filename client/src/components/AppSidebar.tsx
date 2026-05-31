import { Home, Sparkles, Calendar, BarChart3, Settings, Instagram, Users, LogOut, Target, CalendarDays, Youtube, Lightbulb, List, Key, Sun } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const menuItems = [
  { 
    title: "브랜드 분석", 
    url: "/brand-analysis", 
    icon: Target, 
    testId: "nav-brand-analysis",
    description: "브랜드의 USP, 고객 페르소나, 핵심 가치를 AI로 분석합니다"
  },
  { 
    title: "월간 플랜", 
    url: "/monthly-plan", 
    icon: CalendarDays, 
    testId: "nav-monthly-plan",
    description: "AI가 30일치 콘텐츠 주제와 일정을 자동으로 계획합니다"
  },
  { 
    title: "콘텐츠 생성", 
    url: "/", 
    icon: Sparkles, 
    testId: "nav-generate",
    description: "키워드를 입력하면 인스타그램과 블로그 콘텐츠를 AI가 생성합니다"
  },
  {
    title: "유튜브 말씀",
    url: "/youtube-scripture",
    icon: Youtube,
    testId: "nav-youtube-scripture",
    description: "유튜브 영상을 분석하여 성경 말씀 기반 콘텐츠를 생성합니다"
  },
  {
    title: "월간 희망 콘텐츠",
    url: "/monthly-hope",
    icon: Sun,
    testId: "nav-monthly-hope",
    description: "AI가 매달 희망 글귀·이미지·캡션·해시태그를 자동 생성합니다"
  },
  { 
    title: "발명 아이디어", 
    url: "/invention-idea", 
    icon: Lightbulb, 
    testId: "nav-invention-idea",
    description: "발명 아이디어를 인스타그램 카드와 숏츠 스크립트로 변환합니다"
  },
  { 
    title: "콘텐츠 리스트", 
    url: "/content-list", 
    icon: List, 
    testId: "nav-content-list",
    description: "저장된 모든 콘텐츠를 관리하고 재사용합니다"
  },
  { 
    title: "캘린더", 
    url: "/calendar", 
    icon: Calendar, 
    testId: "nav-calendar",
    description: "생성된 콘텐츠의 발행 일정을 달력으로 관리합니다"
  },
  { 
    title: "대시보드", 
    url: "/dashboard", 
    icon: Home, 
    testId: "nav-dashboard",
    description: "저장된 콘텐츠와 발행 현황을 한눈에 확인합니다"
  },
  { 
    title: "분석", 
    url: "/analytics", 
    icon: BarChart3, 
    testId: "nav-analytics",
    description: "콘텐츠 성과와 인사이트를 분석합니다"
  },
  { 
    title: "API 키", 
    url: "/api-keys", 
    icon: Key, 
    testId: "nav-api-keys",
    description: "외부 서비스에서 ContentFlow API를 호출할 수 있는 키를 발급합니다"
  },
  { 
    title: "설정", 
    url: "/settings", 
    icon: Settings, 
    testId: "nav-settings",
    description: "계정 및 앱 설정을 관리합니다"
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isAdmin, logout } = useAuth();

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (user?.firstName || user?.lastName) {
      return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    }
    return user?.email ?? "사용자";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 space-y-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Instagram className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">ContentFlow</span>
        </Link>
        <p className="text-xs text-muted-foreground leading-relaxed">
          AI로 인스타그램 캐러셀과 네이버 블로그 콘텐츠를 자동 생성하고 스케줄링하세요
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                    title={item.description}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>관리자</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/admin"}
                    data-testid="nav-admin"
                  >
                    <Link href="/admin">
                      <Users className="h-4 w-4" />
                      <span>사용자 관리</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-3">
        <SidebarSeparator />
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.profileImageUrl ?? undefined} />
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{getDisplayName()}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start gap-2"
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
