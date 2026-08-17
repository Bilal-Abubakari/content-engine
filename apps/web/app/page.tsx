import { Comparison } from '@/components/landing/comparison';
import { Cta } from '@/components/landing/cta';
import { Faq } from '@/components/landing/faq';
import { Features } from '@/components/landing/features';
import { Footer } from '@/components/landing/footer';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Pricing } from '@/components/landing/pricing';
import { Products } from '@/components/landing/products';
import { SocialProof } from '@/components/landing/social-proof';
import { Testimonials } from '@/components/landing/testimonials';

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Products />
      <SocialProof />
      <HowItWorks />
      <Features />
      <Comparison />
      <Pricing />
      <Testimonials />
      <Faq />
      <Cta />
      <Footer />
    </main>
  );
}
