import type { Metadata } from 'next';
import { Footer } from '@/components/landing/footer';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service — ContentEngine',
  description: 'The terms that govern your use of ContentEngine.',
};

export default function TermsPage() {
  return (
    <main>
      <LegalPage
        title="Terms of Service"
        sections={[
          {
            heading: 'Acceptance of terms',
            body: 'By creating an account or using ContentEngine, you agree to these terms. If you do not agree, do not use the service.',
          },
          {
            heading: 'The service',
            body: 'ContentEngine turns a source link or text into platform-native drafts. Generated drafts are provided as-is; you are responsible for reviewing and editing them before publishing.',
          },
          {
            heading: 'Accounts',
            body: 'You are responsible for activity under your account and for keeping your credentials secure. You must provide accurate information when signing up.',
          },
          {
            heading: 'Plans and billing',
            body: 'Paid plans are billed in advance on a recurring basis through our payment processor. You can upgrade, downgrade, or cancel at any time; access continues until the end of the current billing period. Fees are non-refundable except where required by law.',
          },
          {
            heading: 'Acceptable use',
            body: 'Do not use ContentEngine to generate or publish unlawful, infringing, or abusive content, or to violate the terms of any connected platform.',
          },
          {
            heading: 'Content ownership',
            body: 'You retain ownership of the sources you submit and the drafts you generate. You grant us the limited rights needed to operate the service.',
          },
          {
            heading: 'Disclaimer and liability',
            body: 'The service is provided "as is" without warranties of any kind. To the extent permitted by law, ContentEngine is not liable for indirect or consequential damages arising from your use of the service.',
          },
          {
            heading: 'Changes',
            body: 'We may update these terms from time to time. Continued use after changes take effect constitutes acceptance of the revised terms.',
          },
          {
            heading: 'Contact',
            body: 'Questions about these terms? Reach us at hello@contentengine.app.',
          },
        ]}
      />
      <Footer />
    </main>
  );
}
