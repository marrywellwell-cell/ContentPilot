import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/Dashboard";
import Generate from "@/pages/Generate";
import EditContent from "@/pages/EditContent";
import CalendarPage from "@/pages/CalendarPage";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
import BrandAnalysis from "@/pages/BrandAnalysis";
import MonthlyPlan from "@/pages/MonthlyPlan";
import YouTubeScripture from "@/pages/YouTubeScripture";
import InventionIdea from "@/pages/InventionIdea";
import ContentList from "@/pages/ContentList";
import ApiKeys from "@/pages/ApiKeys";
import Landing from "@/pages/Landing";
import InstagramCallback from "@/pages/InstagramCallback";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Generate} />
      <Route path="/auth/instagram/callback" component={InstagramCallback} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/brand-analysis" component={BrandAnalysis} />
      <Route path="/monthly-plan" component={MonthlyPlan} />
      <Route path="/youtube-scripture" component={YouTubeScripture} />
      <Route path="/invention-idea" component={InventionIdea} />
      <Route path="/content-list" component={ContentList} />
      <Route path="/edit/:id" component={EditContent} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/admin" component={Admin} />
      <Route path="/api-keys" component={ApiKeys} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing onLogin={login} />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
