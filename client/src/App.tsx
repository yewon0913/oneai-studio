import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { lazy, Suspense } from "react";

const ClientsPage = lazy(() => import("./pages/Clients"));
const ClientDetailPage = lazy(() => import("./pages/ClientDetail"));
const ProjectsPage = lazy(() => import("./pages/Projects"));
const ProjectWorkspace = lazy(() => import("./pages/ProjectWorkspace"));
const PromptsPage = lazy(() => import("./pages/Prompts"));
const BatchesPage = lazy(() => import("./pages/Batches"));
const NotificationsPage = lazy(() => import("./pages/Notifications"));
const FinalReviewPage = lazy(() => import("./pages/FinalReview"));
const ClientPreview = lazy(() => import("./pages/ClientPreview"));
const Invitation = lazy(() => import("./pages/Invitation"));
const BeautyPage = lazy(() => import("./pages/beauty"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">로딩중...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/clients" component={ClientsPage} />
        <Route path="/clients/:id" component={ClientDetailPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/projects/:id" component={ProjectWorkspace} />
        <Route path="/prompts" component={PromptsPage} />
        <Route path="/batches" component={BatchesPage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/review" component={FinalReviewPage} />
        <Route path="/preview/:clientId/:token" component={ClientPreview} />
        <Route path="/invitation/:projectId" component={Invitation} />
        <Route path="/beauty" component={BeautyPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
