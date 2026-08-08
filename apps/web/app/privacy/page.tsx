import type { Metadata } from 'next';
import { Footer } from '@/components/landing/footer';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy — ContentEngine',
  description: 'How ContentEngine collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main>
      <LegalPage
        title="Privacy Policy"
        sections={[
          {
            heading: 'Overview',
            body: 'This policy explains what data ContentEngine collects, how we use it, and the choices you have. By using ContentEngine you agree to the practices described here.',
          },
          {
            heading: 'Information we collect',
            body: 'Account details (name and email from your sign-in provider), the sources and drafts you generate, and subscription/billing metadata handled by our payment processor. We do not receive or store your full card details.',
          },
          {
            heading: 'How we use your information',
            body: 'To provide and improve the service, generate and store your repurposed content, manage your subscription, and communicate service-related updates.',
          },
          {
            heading: 'Data storage and security',
            body: 'Your account and subscription data are stored securely. Connected social account tokens are encrypted at rest. We use industry-standard measures to protect your information.',
          },
          {
            heading: 'Third-party services',
            body: 'We rely on trusted providers for authentication, payments, AI generation, and hosting. Each processes data only as needed to deliver the service.',
          },
          {
            heading: 'Your rights',
            body: 'You can access, export, or delete your account data at any time. Contact us to exercise these rights.',
          },
          {
            heading: 'Contact',
            body: 'Questions about this policy? Reach us at hello@contentengine.app.',
          },
        ]}
      />
      <Footer />
    </main>
  );
}
