/*
 * ComingSoon.tsx — Placeholder page for tabs whose branch isn't built yet
 * (History, Plan, Me, Quick Add), so every nav link goes somewhere real.
 */
import { Link } from 'react-router'
import { Card, Page } from '../ui/kit.tsx'

/** Simple "coming next" page with a way back home. */
export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <Page>
      <h1 className="text-[clamp(1.75rem,8vw,2.125rem)] font-black md:text-4xl">{title}</h1>
      <Card className="mt-6 max-w-xl">
        <p className="text-lg font-bold">{text}</p>
        <Link to="/" className="mt-5 inline-grid min-h-12 place-items-center rounded-full bg-pebble px-6 font-black">
          Back to Home
        </Link>
      </Card>
    </Page>
  )
}
