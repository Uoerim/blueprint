import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Blueprint collects, why, who handles it and how to get it deleted.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          Blueprint (blueprint.raqameen.com) is a free idea list and task board for small teams, run from Egypt. This page
          explains what we collect when you use it, why, and what you can ask us to do with it. In short: we keep what the app
          needs to work, we don&apos;t sell it, we don&apos;t show ads, and we don&apos;t track you around the web.
        </p>
      }
    >
      <Section id="collect" title="What we collect">
        <ul>
          <li>
            <strong>Account details.</strong> When you sign in with Google or GitHub, our sign-in provider Clerk receives your
            email address, name and profile picture. We never see your Google or GitHub password.
          </li>
          <li>
            <strong>Your profile.</strong> The @username, display name and colour you choose, and which guided tours
            you&apos;ve finished, so they don&apos;t show again.
          </li>
          <li>
            <strong>What you put in Blueprint.</strong> Teams, ideas, projects, tasks, descriptions, notes, tags, sparks,
            assignments and invites.
          </li>
          <li>
            <strong>Feedback.</strong> If you report a bug or request a feature from the Contact support window: what you
            write, whether it&apos;s a bug or a request, the page you pick (its address only, or none) and a short device summary
            such as &ldquo;iPhone · Safari&rdquo;. To offer recent pages, your browser remembers the last few addresses you opened
            in that tab; they stay on your device unless you send one. The text is encrypted before it&apos;s stored. Only
            Blueprint staff can read it, and we keep it only as long as we need it to fix the problem or consider the idea;
            feedback we reject may be deleted.
          </li>
          <li>
            <strong>Security records.</strong> A log of important actions (for example creating a team, changing someone&apos;s
            role or archiving a project) with the time, your username and a shortened form of the IP address it came from
            (the network only, not your exact address). These records can&apos;t be edited.
          </li>
          <li>
            <strong>Technical data.</strong> Our hosting provider processes your IP address and basic request information to
            deliver pages, stop abuse, block automated traffic and limit how many requests one address or account can send.
          </li>
        </ul>
      </Section>

      <Section id="cookies" title="Cookies">
        <p>We only use cookies the app needs to work:</p>
        <ul>
          <li>Clerk&apos;s cookies, to keep you signed in;</li>
          <li>
            <code className="font-mono text-[14px] text-ink">bp-theme</code>, which remembers whether you picked the dark, light or system theme;
          </li>
          <li>
            <code className="font-mono text-[14px] text-ink">bp-last-team</code>, which remembers the team you were last in, so the Ideas and Tasks tabs of the
            installed app open it;
          </li>
          <li>
            <code className="font-mono text-[14px] text-ink">bp-app-preview</code>, only if you switch on the app-layout preview.
          </li>
        </ul>
        <p>
          Your browser also keeps a few things on your device: whether you dismissed or accepted the offer to install Blueprint,
          a copy of Blueprint&apos;s own app files (its code, styles, fonts and logo) so it opens faster, and a
          &ldquo;you&apos;re offline&rdquo; screen for when you lose connection. None of this contains your data, and none of it
          leaves your device. Guided tours show sample teams, ideas and invites on your screen only; they&apos;re never saved. There are no analytics, advertising or tracking cookies, so there is no cookie banner.
        </p>
      </Section>

      <Section id="use" title="How we use it">
        <ul>
          <li>To run Blueprint: sign you in, save your work and show it to your teammates.</li>
          <li>To let other signed-in people find you by your @username so they can invite you to a team.</li>
          <li>To keep the service secure, investigate abuse and fix problems.</li>
          <li>To reply when you contact us, and to tell you about important changes to the service.</li>
        </ul>
        <p>
          We do not sell your data, use it for advertising, or use your content to train AI models.
        </p>
      </Section>

      <Section id="see" title="Who can see what">
        <ul>
          <li>
            <strong>Your teammates</strong> see everything in the teams you share with them, along with your @username, display
            name, colour and profile picture.
          </li>
          <li>
            <strong>Other signed-in users</strong> can see your @username, display name and colour when they search for people to
            invite. They cannot see your email address or the content of teams they are not in.
          </li>
          <li>
            <strong>Team owners, co-owners and members with a role that allows it</strong> can manage the team&apos;s members and content. Tasks marked private are visible only to their assignees, their creator and the people allowed to see them.
          </li>
          <li>
            <strong>Blueprint staff</strong> (support, moderators and site admins) can see account details such as your email,
            @username, teams and activity records, to help you and to enforce the Terms. They can suspend or delete accounts
            that break the rules. They also read the bug reports you send. The admin tools never show the text of your ideas,
            projects or tasks.
          </li>
        </ul>
      </Section>

      <Section id="providers" title="Services that handle your data for us">
        <ul>
          <li><strong>Clerk</strong>: sign-in and account management.</li>
          <li><strong>Neon</strong>: the database that stores your account and content.</li>
          <li><strong>Vercel</strong>: hosting and delivery of the website.</li>
          <li><strong>Google and GitHub</strong>: only when you choose to sign in with them.</li>
          <li>
            <strong>Ko-fi</strong>: only if you choose to send a tip. Ko-fi handles the payment under its own privacy policy, and
            we never see your card details.
          </li>
        </ul>
        <p>
          Blueprint doesn&apos;t send your content to any AI service. If you use an AI assistant to write a plan for
          &ldquo;Import from JSON&rdquo;, what you share with that assistant is up to you and is covered by its own terms and
          privacy policy; Blueprint only receives the plan you paste in.
        </p>
        <p>
          These providers may store or process data outside Egypt, including in the United States and the European Union. We
          only share what each one needs to do its job.
        </p>
      </Section>

      <Section id="keep" title="How long we keep it">
        <p>
          We keep your account and content for as long as your account exists. When you ask us to delete your account, we
          delete your personal details within 30 days. Content you added to a team that other people still use may stay in that
          team, with your name removed, so the team&apos;s history makes sense; ask if you want it removed too. Security
          records are kept only as long as they are needed to protect the service. When an account is deleted, its former
          @username stays in those records so staff can tell which account was removed; its email, name and profile are
          deleted.
        </p>
      </Section>

      <Section id="rights" title="Your rights">
        <p>
          You can ask us to show you the personal data we hold about you, correct it, give you a copy, delete it, or stop using
          it for a particular purpose. Email <Mail /> from the address on your account and we will reply within 30 days.
        </p>
        <p>
          These rights apply under Egypt&apos;s Personal Data Protection Law (No. 151 of 2020) and, where it applies to you,
          the EU General Data Protection Regulation. You can also complain to the data protection authority where you live.
        </p>
      </Section>

      <Section id="security" title="Security">
        <p>
          All traffic is encrypted with HTTPS, sign-in is handled by Clerk, and every request is checked so people can only
          reach the teams they belong to. The text of your ideas, projects and tasks (titles, descriptions and notes) is
          encrypted with AES-256-GCM before it is stored, using a key unique to your team, so it never sits in the database
          as plain text. Tags, statuses and dates stay unencrypted so the app can sort and filter them. No system is perfectly
          secure, so if you find a problem please tell us at <Mail />.
        </p>
      </Section>

      <Section id="children" title="Children">
        <p>
          Blueprint is not meant for children. You must be at least 13 years old, or older if the law where you live sets a
          higher age for using online services without a parent&apos;s permission.
        </p>
      </Section>

      <Section id="changes" title="Changes to this policy">
        <p>
          If we change this policy we will update the date at the top. For important changes we will also tell you in the app
          or by email before they take effect. See also our <Link href="/terms" className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">Terms of Service</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
