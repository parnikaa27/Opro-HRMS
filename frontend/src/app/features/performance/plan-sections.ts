import { Goal, PlanEntry, PlanSection } from '../../models/performance';

export type SectionKey = 'goals' | PlanSection;

interface SectionInfo {
  key: SectionKey;
  title: string;
  // What the person is asked for, in a line.
  ask: string;
  // The labels and examples for one entry. Goals have their own form.
  entryLabel: string;
  titleLabel: string;
  titleExample: string;
  detailsLabel?: string;
  detailsExample?: string;
  hasTarget?: boolean;
}

// The plan, in the order people fill it in. Goals come first because they're rated at the end of the year.
export const SECTIONS: readonly SectionInfo[] = [
  {
    key: 'goals',
    title: 'Goals and KPIs',
    ask: 'What you’ll deliver this year, how it’s measured, and how much each counts.',
    entryLabel: 'goal',
    titleLabel: 'Goal',
    titleExample: '',
  },
  {
    key: 'certification',
    title: 'Plan for certifications',
    ask: 'Certifications you aim to earn, and by when.',
    entryLabel: 'certification',
    titleLabel: 'Certification',
    titleExample: 'NEBOSH International General Certificate',
    detailsLabel: 'How you’ll get it',
    detailsExample: 'Evening course in Malé, exam in May',
    hasTarget: true,
  },
  {
    key: 'learning',
    title: 'Learning and development',
    ask: 'Skills you want to build and how you’ll build them.',
    entryLabel: 'skill',
    titleLabel: 'What you’ll learn',
    titleExample: 'Advanced Excel for cost reports',
    detailsLabel: 'How',
    detailsExample: 'Online course, then use it for the monthly report',
  },
  {
    key: 'accomplishment',
    title: 'Accomplishments',
    ask: 'What you achieved, and what came of it.',
    entryLabel: 'accomplishment',
    titleLabel: 'What you did',
    titleExample: 'Handed over phase 1 two weeks early',
    detailsLabel: 'The result',
    detailsExample: 'The client moved in before the season started',
  },
  {
    key: 'strength',
    title: 'Strengths',
    ask: 'What you’re good at, one line each.',
    entryLabel: 'strength',
    titleLabel: 'Strength',
    titleExample: 'Keeping subcontractors on schedule',
  },
];

export const sectionInfo = (key: SectionKey) => SECTIONS.find((section) => section.key === key) ?? SECTIONS[0];

// The titles in one section, for a tile's preview or a reader's list.
export const entriesIn = (key: SectionKey, goals: readonly Goal[], entries: readonly PlanEntry[]) =>
  key === 'goals' ? goals.map(({ title }) => title) : entries.filter(({ section }) => section === key).map(({ title }) => title);
