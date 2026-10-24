import { ArrowRight, CalendarCheck2, Compass, LineChart, Lock, UserRound } from 'lucide-react';
import { LogoMark } from '../components/Logo';
import { useHealthData } from '../store/HealthDataContext';

export function navigate(route: string) {
  window.location.hash = `#/${route}`;
}

export function WelcomePage() {
  const { root, rootDispatch } = useHealthData();
  const user = root.profiles.user?.data.profile;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-teal-50 via-white to-slate-50">
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10 sm:py-16">
        <div className="flex items-center gap-3">
          <LogoMark size={44} />
          <p className="text-2xl font-semibold tracking-tight text-slate-900">
            Connect<span className="text-teal-700">Health</span>
          </p>
        </div>
        <h1 className="mt-8 text-3xl leading-tight font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Your health information, connected.
          <br />
          <span className="text-teal-800">Your next steps, clearer.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-600">
          Bring conditions, symptoms, sleep, medications and other observations together, see patterns worth discussing, and prepare for appointments and care decisions with your clinicians.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {user ? (
            <button
              type="button"
              onClick={() => {
                rootDispatch({ type: 'switchProfile', slot: 'user' });
                navigate('overview');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-base font-medium text-white shadow-sm hover:bg-teal-800"
            >
              <UserRound size={18} aria-hidden="true" /> Continue as {user.preferredName || user.displayName}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate('onboarding')}
            className={
              user
                ? 'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-medium text-slate-800 ring-1 ring-slate-300 ring-inset hover:bg-white'
                : 'inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-base font-medium text-white shadow-sm hover:bg-teal-800'
            }
          >
            {user ? 'Start a new profile' : 'Create My Health Profile'} <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              rootDispatch({ type: 'enterDemo' });
              navigate('overview');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-medium text-teal-800 ring-1 ring-teal-200 ring-inset hover:bg-teal-50"
          >
            Explore Demo Patient
          </button>
        </div>

        <ul className="mt-10 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
          <li className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <LineChart size={18} className="shrink-0 text-teal-700" aria-hidden="true" /> Transparent patterns from your own records, with their limits shown.
          </li>
          <li className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <CalendarCheck2 size={18} className="shrink-0 text-teal-700" aria-hidden="true" /> Reports and questions to take to your next appointment.
          </li>
          <li className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <Compass size={18} className="shrink-0 text-teal-700" aria-hidden="true" /> Next steps for specialists, referrals and insurance calls.
          </li>
        </ul>

        <div className="mt-8 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="note">
          <Lock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Privacy note:</span> this prototype stores your profile only in this browser’s local storage – nothing is sent to a server. Local storage is not secure storage for real medical records, so please avoid entering information you would not want kept on this device. All preloaded demo patient data is synthetic (fictional).
          </p>
        </div>
        <p className="mt-4 text-xs text-slate-500">ConnectHealth supports you and your clinicians. It does not diagnose conditions or recommend treatment.</p>
      </main>
    </div>
  );
}
