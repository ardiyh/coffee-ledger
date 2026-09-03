import { LandingNav } from "./_landing/nav";
import { Hero } from "./_landing/hero";
import { LedgerIdea } from "./_landing/ledger-idea";
import { Migration } from "./_landing/migration";
import { ColorDecision } from "./_landing/color-decision";
import { StackLinks } from "./_landing/stack-links";

// Public portfolio landing. No requireSession(), no database: this page is
// visible to anyone with the link, which is the point. The allowlist means
// nobody but the owner can ever sign in, so this reads as a project
// showcase rather than a product page. Masuk is the only call to action.
export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <LedgerIdea />
        <Migration />
        <ColorDecision />
        <StackLinks />
      </main>
    </div>
  );
}
