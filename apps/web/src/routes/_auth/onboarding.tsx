import { createFileRoute, Link } from '@tanstack/react-router';
import { OnboardingForm } from '../../components/onboarding-form';

export const Route = createFileRoute('/_auth/onboarding')({
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <section style={{ maxWidth: '640px' }}>
      <h1>Import Decks</h1>
      <p style={{ color: '#666' }}>
        Paste Fabrary deck URLs below to start tracking your decks against your collection.
      </p>
      <OnboardingForm />
      <div style={{ marginTop: '1.5rem' }}>
        <Link to="/home">Go to Home</Link>
      </div>
    </section>
  );
}
