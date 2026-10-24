import { useEffect, useState } from 'react';
import { HealthDataProvider } from './store/HealthDataContext';
import { EditorProvider } from './components/forms/EditorContext';
import { Layout, NAV, type RouteId } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { TimelinePage } from './pages/TimelinePage';
import { PatternsPage } from './pages/PatternsPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { SummaryPage } from './pages/SummaryPage';
import { TasksPage } from './pages/TasksPage';
import { RecordsPage } from './pages/RecordsPage';

const ROUTES: RouteId[] = [...NAV.map((n) => n.id), 'records'];

function parseHash(): RouteId {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0] as RouteId;
  return ROUTES.includes(h) ? h : 'overview';
}

export function useHashRoute(): RouteId {
  const [route, setRoute] = useState<RouteId>(parseHash);
  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      window.scrollTo?.({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

function Page({ route }: { route: RouteId }) {
  switch (route) {
    case 'overview':
      return <OverviewPage />;
    case 'timeline':
      return <TimelinePage />;
    case 'patterns':
      return <PatternsPage />;
    case 'connections':
      return <ConnectionsPage />;
    case 'summary':
      return <SummaryPage />;
    case 'tasks':
      return <TasksPage />;
    case 'records':
      return <RecordsPage />;
  }
}

export default function App() {
  const route = useHashRoute();
  useEffect(() => {
    const label = NAV.find((n) => n.id === route)?.label ?? 'Records';
    document.title = `${label} · HealthConnect (synthetic)`;
  }, [route]);
  return (
    <HealthDataProvider>
      <EditorProvider>
        <Layout route={route}>
          <Page route={route} />
        </Layout>
      </EditorProvider>
    </HealthDataProvider>
  );
}
