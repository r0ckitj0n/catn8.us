import React from 'react';

import { Celebr8Activity, Celebr8ActivityPrintable } from '../../types/celebr8';
import {
  formatMinutes,
  formatPlayers,
  formatUsdRange,
  variationText,
} from './celebr8ActivityFormat';

export type PrintSheetKind = 'setup' | 'play' | 'printable' | 'packet';

/** @deprecated alias kept for callers */
export type Celebr8PrintSheetKind = PrintSheetKind;

type Props = {
  activity: Celebr8Activity;
  sheet: PrintSheetKind;
  printableIndex?: number;
  partyTitle?: string;
};

function SheetHeader({
  activity,
  subtitle,
  partyTitle,
}: {
  activity: Celebr8Activity;
  subtitle: string;
  partyTitle?: string;
}) {
  return (
    <header className="celebr8-print-header">
      <p className="celebr8-print-kicker">CELEBR8 · US Letter · 2026 estimates</p>
      <h1>{activity.name}</h1>
      <p className="celebr8-print-sub">{subtitle}</p>
      {partyTitle ? <p className="celebr8-print-party">Party: {partyTitle}</p> : null}
      <p className="celebr8-print-meta">
        {activity.preferred_holiday || 'Any'} · {activity.category} · ages {activity.ages}
        {activity.age_range ? ` (${activity.age_range})` : ''} · {activity.location_type || 'both'}
        {' · '}setup {formatMinutes(activity.setup_minutes)} · play {formatMinutes(activity.play_minutes)}
        {' · '}players {formatPlayers(activity.min_players, activity.max_players)}
        {' · '}cost {formatUsdRange(activity.estimated_cost_low, activity.estimated_cost_high)}
      </p>
    </header>
  );
}

function Steps({ title, steps }: { title: string; steps?: string[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <section className="celebr8-print-section">
      <h2>{title}</h2>
      <ol>
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </section>
  );
}

export function Celebr8ActivityPrintSheets({
  activity,
  sheet,
  printableIndex = 0,
  partyTitle,
}: Props) {
  const supplies = activity.supplies_detail?.length
    ? activity.supplies_detail
    : (activity.supplies || []).map((item) => ({
      item, qty: '1', unit_cost_est: null as number | null, notes: '', have: 0,
    }));

  if (sheet === 'setup') {
    return (
      <article className="celebr8-print-sheet">
        <SheetHeader activity={activity} subtitle="Setup Instructions" partyTitle={partyTitle} />
        {activity.objective ? (
          <section className="celebr8-print-section"><h2>Objective</h2><p>{activity.objective}</p></section>
        ) : null}
        <section className="celebr8-print-section">
          <h2>Supplies checklist</h2>
          <table className="celebr8-print-table">
            <thead>
              <tr><th>☐</th><th>Item</th><th>Qty</th><th>Est. unit</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {supplies.map((s, i) => (
                <tr key={i}>
                  <td className="celebr8-print-check">☐</td>
                  <td>{s.item}</td>
                  <td>{s.qty}</td>
                  <td>{s.unit_cost_est != null ? `$${Number(s.unit_cost_est).toFixed(2)}` : '—'}</td>
                  <td>{s.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="celebr8-print-footnote">
            Cost range for this station: {formatUsdRange(activity.estimated_cost_low, activity.estimated_cost_high)} (2026 USD estimates for ~50–70 guests unless noted).
          </p>
        </section>
        <Steps title="Setup steps" steps={activity.setup_instructions} />
        {activity.tech_needs ? (
          <section className="celebr8-print-section"><h2>Power / music / tech</h2><p>{activity.tech_needs}</p></section>
        ) : null}
        {activity.volunteers_needed ? (
          <section className="celebr8-print-section"><h2>Hosts / volunteers</h2><p>{activity.volunteers_needed}</p></section>
        ) : null}
        {activity.safety_notes ? (
          <section className="celebr8-print-section"><h2>Safety</h2><p>{activity.safety_notes}</p></section>
        ) : null}
        {activity.senior_role ? (
          <section className="celebr8-print-section"><h2>Elders&apos; role</h2><p style={{ whiteSpace: 'pre-wrap' }}>{activity.senior_role}</p></section>
        ) : null}
        {activity.hearing_vision_notes ? (
          <section className="celebr8-print-section"><h2>Hearing / vision</h2><p style={{ whiteSpace: 'pre-wrap' }}>{activity.hearing_vision_notes}</p></section>
        ) : null}
        <Steps title="Teardown / cleanup" steps={activity.teardown} />
      </article>
    );
  }

  if (sheet === 'play') {
    return (
      <article className="celebr8-print-sheet">
        <SheetHeader activity={activity} subtitle="How to Play / Station Rules" partyTitle={partyTitle} />
        {activity.summary ? (
          <section className="celebr8-print-section"><h2>At a glance</h2><p>{activity.summary}</p></section>
        ) : null}
        {activity.senior_role ? (
          <section className="celebr8-print-section"><h2>Elders&apos; role</h2><p style={{ whiteSpace: 'pre-wrap' }}>{activity.senior_role}</p></section>
        ) : null}
        <Steps title="How to play" steps={activity.how_to_play} />
        {activity.rules_scoring ? (
          <section className="celebr8-print-section"><h2>Rules & scoring</h2><p style={{ whiteSpace: 'pre-wrap' }}>{activity.rules_scoring}</p></section>
        ) : null}
        {(activity.winning_notes || activity.prizes) ? (
          <section className="celebr8-print-section">
            <h2>Winning / prizes</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{activity.winning_notes || activity.prizes}</p>
          </section>
        ) : null}
        {activity.tips ? (
          <section className="celebr8-print-section"><h2>Host tips</h2><p style={{ whiteSpace: 'pre-wrap' }}>{activity.tips}</p></section>
        ) : null}
      </article>
    );
  }

  const printable: Celebr8ActivityPrintable | undefined = (activity.printables || [])[printableIndex];
  if (!printable) {
    return (
      <article className="celebr8-print-sheet">
        <SheetHeader activity={activity} subtitle="Printable" partyTitle={partyTitle} />
        <p>No printable content for this sheet.</p>
      </article>
    );
  }

  const largePrint = /large.?print/i.test(printable.title)
    || printable.kind === 'large_print'
    || printable.kind === 'ballot'
    || printable.kind === 'scorecard';

  return (
    <article className={`celebr8-print-sheet${largePrint ? ' celebr8-print-sheet--large' : ''}`}>
      <SheetHeader activity={activity} subtitle={printable.title} partyTitle={partyTitle} />
      <section className={`celebr8-print-section celebr8-print-pre${largePrint ? ' celebr8-print-pre--large' : ''}`}>
        <pre>{printable.content}</pre>
      </section>
      {(activity.variations && activity.variations.length > 0) ? (
        <section className="celebr8-print-section">
          <h2>Variations</h2>
          <ul>
            {activity.variations.map((v, i) => <li key={i}>{variationText(v)}</li>)}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

export function Celebr8PartyActivityPacket({
  activities,
  partyTitle,
}: {
  activities: Celebr8Activity[];
  partyTitle: string;
}) {
  return (
    <div className="celebr8-print-packet">
      {activities.map((activity) => (
        <React.Fragment key={activity.id}>
          <Celebr8ActivityPrintSheets activity={activity} sheet="setup" partyTitle={partyTitle} />
          <div className="celebr8-print-break" />
          <Celebr8ActivityPrintSheets activity={activity} sheet="play" partyTitle={partyTitle} />
          {(activity.printables || []).map((_, idx) => (
            <React.Fragment key={`${activity.id}-p-${idx}`}>
              <div className="celebr8-print-break" />
              <Celebr8ActivityPrintSheets
                activity={activity}
                sheet="printable"
                printableIndex={idx}
                partyTitle={partyTitle}
              />
            </React.Fragment>
          ))}
          <div className="celebr8-print-break" />
        </React.Fragment>
      ))}
    </div>
  );
}
