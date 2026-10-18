import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Blueprint, including content, acceptable use and connecting Claude.",
  alternates: { canonical: "/terms" },
};

const link = "text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These terms are the agreement between you and Blueprint (blueprint.raqameen.com) for using the service. By creating
          an account or using Blueprint you agree to them. If you don&apos;t agree, please don&apos;t use Blueprint.
        </p>
      }
    >
      <Section id="service" title="1. The service">
        <p>
          Blueprint lets teams collect ideas, turn them into projects and track tasks. It is currently free, with no limits on
          teams, ideas, projects or tasks. We may add, change or remove features. If we ever introduce paid plans or limits, we
          will tell you in advance and nothing you already made will be locked away without notice. Any payments would be handled
          by a payment provider under its own terms.
        </p>
        <p>
          Blueprint&apos;s source code is published on{" "}
          <a href="https://github.com/Uoerim/blueprint" className={link} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>{" "}
          under the PolyForm Noncommercial License 1.0.0. These terms cover the hosted service at blueprint.raqameen.com.
          Copies that other people host are not run by us, and these terms don&apos;t apply to them.
        </p>
      </Section>

      <Section id="account" title="2. Your account">
        <ul>
          <li>You must be at least 13 years old, or older if the law where you live requires it.</li>
          <li>One account is for one person. Keep your Google or GitHub sign-in secure; you are responsible for what happens under your account.</li>
          <li>Don&apos;t pick an @username that impersonates someone else or a brand you don&apos;t represent. We may reclaim usernames that do.</li>
        </ul>
      </Section>

      <Section id="content" title="3. Your content">
        <p>
          You own everything you put into Blueprint. You give us permission to store, copy and display it only as needed to run
          the service for you and your teammates, for example showing your tasks to people in your team. This permission ends
          when the content is deleted, apart from routine backups that expire on their own.
        </p>
        <p>
          You are responsible for having the right to share what you post. Team owners, co-owners and members whose role allows it can edit or remove content and
          members in their team.
        </p>
        <p>
          That includes content you import, such as a plan written by an AI assistant: check it before you import it, and
          follow the terms of whatever tool you used to make it.
        </p>
        <p>
          If you send us feedback, bug reports or feature ideas, we may use them to improve Blueprint without owing you
          anything for them. Thank you for them.
        </p>
      </Section>

      <Section id="use" title="4. Acceptable use">
        <p>Please don&apos;t:</p>
        <ul>
          <li>post anything illegal, or that harasses, threatens or exposes other people&apos;s private information;</li>
          <li>send spam invites or use Blueprint to advertise;</li>
          <li>upload malware, or try to break into accounts, teams or our systems;</li>
          <li>use scripts, headless browsers or other automated tools to access the app or its API, scrape it, or get around rate limits or security checks (connecting Claude the way section 5 describes is the one exception);</li>
          <li>resell or rebrand Blueprint as your own service, or use the Blueprint name or logo for a copy you run.</li>
        </ul>
      </Section>

      <Section id="claude" title="5. Connecting Claude">
        <p>
          You can connect Claude, an AI assistant made by Anthropic, to work in the teams you pick, if each team&apos;s owner
          allows it. When you do:
        </p>
        <ul>
          <li>Claude acts on your behalf and with your permissions. You&apos;re responsible for what it does in Blueprint, just as if you had done it yourself, so check its work.</li>
          <li>Content Claude reads is sent to Anthropic, and your use of Claude is governed by Anthropic&apos;s terms. Only connect teams whose owner allows it, and keep in mind that your teammates&apos; content may be part of what Claude reads.</li>
          <li>Team owners choose whether Claude may be used in their team and can switch it off at any time.</li>
          <li>Don&apos;t use Claude to get around these terms, rate limits or anyone&apos;s permissions. We may limit or end connections that are misused.</li>
        </ul>
        <p>Blueprint isn&apos;t affiliated with Anthropic, and we can&apos;t guarantee how well Claude performs or that it will always be available.</p>
      </Section>

      <Section id="tips" title="6. Tips on Ko-fi">
        <p>
          Tips through Ko-fi are voluntary gifts that help keep Blueprint running. They don&apos;t unlock features or create
          any obligation on our side. Payments are processed by Ko-fi under{" "}
          <a href="https://more.ko-fi.com/terms" target="_blank" rel="noopener noreferrer" className={link}>its own terms</a>, and refunds follow Ko-fi&apos;s rules and the law.
        </p>
      </Section>

      <Section id="ending" title="7. Ending things">
        <p>
          You can stop using Blueprint at any time and ask us to delete your account at <Mail />. We may suspend or close
          accounts that break these terms, usually after a warning unless the problem is serious. If we ever shut Blueprint down,
          we will give at least 30 days&apos; notice so you can ask for a copy of your data.
        </p>
      </Section>

      <Section id="warranty" title="8. No warranty">
        <p>
          Blueprint is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We work to keep it running and your data safe,
          but we can&apos;t promise it will always be available or error-free, or that data will never be lost. Keep your own copy
          of anything you can&apos;t afford to lose.
        </p>
      </Section>

      <Section id="liability" title="9. Limits on liability">
        <p>
          As far as the law allows, we are not liable for indirect or consequential losses, such as lost profits, lost data or
          business interruption, that come from using Blueprint. Our total liability for any claim is limited to the greater of
          what you paid us in the 12 months before the claim or 50 US dollars. Nothing here limits rights you have under consumer
          protection laws that can&apos;t be waived.
        </p>
      </Section>

      <Section id="law" title="10. Governing law">
        <p>
          These terms are governed by the laws of the Arab Republic of Egypt. Any dispute will be handled by the competent courts
          of Egypt, unless the consumer law of the country where you live gives you the right to bring it there.
        </p>
      </Section>

      <Section id="changes" title="11. Changes to these terms">
        <p>
          We may update these terms. We will change the date at the top and, for important changes, tell you in the app or by
          email before they take effect. If you keep using Blueprint after that, the new terms apply. How we handle personal data
          is explained in our <Link href="/privacy" className={link}>Privacy Policy</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
