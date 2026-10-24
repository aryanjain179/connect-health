import { useEffect, useState } from 'react';
import { HealthDataProvider, useHealthData } from './store/HealthDataContext';
import { EditorProvider } from './components/forms/EditorContext';
import { Layout, NAV, type RouteId } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { TimelinePage } from './pages/TimelinePage';
import { PatternsPage } from './pages/PatternsPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { SummaryPage } from './pages/SummaryPage';
import { TasksPage } from './pages/TasksPage';
import { RecordsPage } from './pages/RecordsPage';
import { WelcomePage } from './pages/WelcomePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ReviewPage } from './pages/ReviewPage';
import { NavigatorPage } from './pages/NavigatorPage';
import { AskPage } from './pages/AskPage';
import { JournalPage } from './pages/JournalPage';
import { SettingsPage } from './pages/SettingsPage';
import { SharedViewPage } from './pages/SharedViewPage';

const APP_ROUTES = NAV.map((n) => n.id);

export interface HashRoute {
  route: string;
  params: URLSearchParams;
  rest: string[];
}

function parseHash(): HashRoute {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const [route, ...rest] = path.split('/');
  return { route: route || '', params: new URLSearchParams(query ?? ''), rest };
}

export function useHashRoute(): HashRoute {
  const [r, setR] = useState<HashRoute>(parseHash);
  useEffect(() => {
    const on = () => {
      setR(parseHash());
      window.scrollTo?.({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

function Page({ route, params }: { route: RouteId; params: URLSearchParams }) {
  switch (route) {
    case 'overview':
      return <OverviewPage />;
    case 'timeline':
      return <TimelinePage initialDate={params.get('date')} />;
    case 'patterns':
      return <PatternsPage />;
    case 'review':
      return <ReviewPage focusId={params.get('flag')} />;
    case 'connections':
      return <ConnectionsPage />;
    case 'ask':
      return <AskPage />;
    case 'journal':
      return <JournalPage />;
    case 'navigator':
      return <NavigatorPage />;
    case 'summary':
      return <SummaryPage />;
    case 'tasks':
      return <TasksPage />;
    case 'records':
      return <RecordsPage />;
    case 'settings':
      return <SettingsPage />;
  }
}

function Router() {
  const { route, params, rest } = useHashRoute();
  const { root, rootDispatch } = useHealthData();

  // Shareable demo link: #/demo or #/demo/<page> opens the synthetic demo patient.
  useEffect(() => {
    if (route !== 'demo') return;
    rootDispatch({ type: 'enterDemo' });
    const target = APP_ROUTES.includes(rest[0] as RouteId) ? rest[0] : 'overview';
    window.location.replace(`#/${target}`);
  }, [route, rest, rootDispatch]);

  useEffect(() => {
    const label = NAV.find((n) => n.id === route)?.label ?? (route === 'onboarding' ? 'Create profile' : 'Welcome');
    document.title = `${label} · ConnectHealth`;
  }, [route]);

  // All hooks run before any early return (rules of hooks).
  if (route === 'demo') return null;
  if (route === 'onboarding') return <OnboardingPage />;
  if (!root.active || route === 'welcome' || !APP_ROUTES.includes(route as RouteId)) {
    if (root.active && route !== 'welcome' && route !== 'shared') {
      // Unknown route while a profile is active → overview.
      return (
        <Layout route="overview">
          <OverviewPage />
        </Layout>
      );
    }
    if (route === 'shared' && root.active) return <SharedViewPage personId={rest[0] ?? ''} />;
    return <WelcomePage />;
  }
  return (
    <Layout route={route as RouteId}>
      <Page route={route as RouteId} params={params} />
    </Layout>
  );
}

export default function App() {
  return (
    <HealthDataProvider>
      <EditorProvider>
        <Router />
      </EditorProvider>
    </HealthDataProvider>
  );
}
