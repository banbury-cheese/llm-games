import type { SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { GameType } from '@/types/game';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ className, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      {...props}
      className={cn('h-5 w-5', className)}
    >
      {children}
    </svg>
  );
}

export function BrandArcadeMarkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="7" width="18" height="10" rx="4" fill="#141414" />
      <rect x="4.5" y="8.5" width="15" height="7" rx="3" fill="#f5f0eb" />
      <rect x="5.75" y="9.5" width="7.75" height="5" rx="2.5" fill="#7FB2FF" />
      <rect x="14" y="9.5" width="4.25" height="5" rx="2.1" fill="#F35757" />
      <path d="M8.5 10.7v2.6M7.2 12h2.6" stroke="#141414" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16.1" cy="11.4" r="0.95" fill="#141414" />
      <circle cx="16.1" cy="13.5" r="0.95" fill="#141414" />
      <path d="M9 6.4L11 4.5M15 6.4l-2-1.9" stroke="#AFA3FF" strokeWidth="1.2" strokeLinecap="round" />
    </IconBase>
  );
}

export function ThemeSunIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4.1" fill="#F2995E" />
      <circle cx="12" cy="12" r="2.15" fill="#ECD227" />
      <path d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6" stroke="#F2995E" strokeWidth="1.35" strokeLinecap="round" />
    </IconBase>
  );
}

export function ThemeMoonIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M15.4 4.1c-2.7.4-4.9 2.8-4.9 5.8 0 3.3 2.7 6 6 6 1.3 0 2.4-.4 3.4-1.1-.9 2.8-3.5 4.8-6.7 4.8-3.9 0-7.1-3.2-7.1-7.1 0-3.7 2.9-6.7 6.5-7 .8-.1 1.6 0 2.4.2.3.1.3.4.1.6-.4.4-.7.9-.9 1.4-.1.2 0 .4.2.4.3 0 .5-.1.8-.2.3-.1.6.2.5.5-.1.4-.2.8-.3 1.2-.1.2.1.4.3.4.4 0 .8-.1 1.2-.2.3-.1.5.2.4.5-.3.9-.7 1.8-1.4 2.5z" fill="#7FB2FF" />
      <circle cx="16.9" cy="7.5" r="1.1" fill="#AFA3FF" />
    </IconBase>
  );
}

export function TutorSparkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2.8l1.9 5.2 5.3 1.9-5.3 1.9-1.9 5.2-1.9-5.2-5.3-1.9 5.3-1.9L12 2.8z" fill="#ECD227" />
      <path d="M18.5 13.8l.9 2.3 2.2.9-2.2.8-.9 2.3-.8-2.3-2.3-.8 2.3-.9.8-2.3z" fill="#AFA3FF" />
    </IconBase>
  );
}

function FlashcardsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4.4" y="6.5" width="10.6" height="12" rx="2.2" fill="#7FB2FF" />
      <rect x="8.8" y="4.9" width="10.8" height="12.6" rx="2.4" fill="#F35757" />
      <path d="M11.4 9.4h5.6M11.4 12.1h4.5M11.4 14.8h3.3" stroke="#141414" strokeWidth="1.2" strokeLinecap="round" />
    </IconBase>
  );
}

function MatchingIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7.3 14.8l-1.7 1.7a2.8 2.8 0 003.9 3.9l3.3-3.3a2.8 2.8 0 00-3.9-3.9l-.8.8M16.7 9.2l1.7-1.7a2.8 2.8 0 00-3.9-3.9L11.2 6.9a2.8 2.8 0 003.9 3.9l.8-.8" stroke="#141414" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.1" cy="16.9" r="1.2" fill="#7FB2FF" />
      <circle cx="16.9" cy="7.1" r="1.2" fill="#F2995E" />
    </IconBase>
  );
}

function QuizIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.2" fill="#F35757" />
      <path d="M9.7 9.6a2.4 2.4 0 114.8 0c0 1.5-1.7 2.1-2.3 3.2M12.1 16.1h0" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12.1" cy="16.1" r="1" fill="#fff" />
    </IconBase>
  );
}

function TypeInIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="2.8" y="6.3" width="18.4" height="11.6" rx="2.7" fill="#AFA3FF" />
      <path d="M6 10.2h1.8M9 10.2h1.8M12 10.2h1.8M15 10.2h1.8M6 13.4h12" stroke="#141414" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M18.4 14.4l2.1 2.3-2.1 2.3" stroke="#F35757" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function HungryBugIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <ellipse cx="12" cy="13" rx="5.6" ry="4.6" fill="#A6BE59" />
      <circle cx="8.4" cy="13" r="1.2" fill="#141414" />
      <circle cx="11.8" cy="13" r="1.2" fill="#141414" />
      <circle cx="15.4" cy="13" r="1.2" fill="#141414" />
      <path d="M10.1 8.7L8.8 6.8M13.9 8.7l1.3-1.9" stroke="#141414" strokeWidth="1.3" strokeLinecap="round" />
    </IconBase>
  );
}

function CrosswordIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" fill="#7FB2FF" />
      <path d="M8 4v16M12 4v16M16 4v16M4 8h16M4 12h16M4 16h16" stroke="#141414" strokeOpacity="0.7" strokeWidth="1.1" />
      <rect x="4" y="8" width="4" height="4" fill="#141414" fillOpacity="0.86" />
      <rect x="12" y="16" width="4" height="4" fill="#141414" fillOpacity="0.86" />
      <rect x="16" y="4" width="4" height="4" fill="#141414" fillOpacity="0.86" />
    </IconBase>
  );
}

function TestModeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="2.3" fill="#F2995E" />
      <rect x="8.3" y="2.3" width="7.4" height="3.2" rx="1.4" fill="#141414" />
      <path d="M8.2 9.1h7.6M8.2 12.2h7.6M8.2 15.3h5.1" stroke="#141414" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M15 15.8l1.2 1.2 2.1-2.2" stroke="#A6BE59" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function SnowmanIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="15.2" r="4.7" fill="#EAF1FF" />
      <circle cx="12" cy="8.6" r="3.1" fill="#fff" />
      <path d="M8.8 5.2h6.4M9.4 4h5.2" stroke="#141414" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="11" cy="8.2" r="0.45" fill="#141414" />
      <circle cx="13" cy="8.2" r="0.45" fill="#141414" />
      <path d="M12 9.2l1.7.4L12 10.2" stroke="#F2995E" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13.7" r="0.6" fill="#141414" />
      <circle cx="12" cy="16.2" r="0.6" fill="#141414" />
    </IconBase>
  );
}

function UnscrambleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.6" y="6.2" width="6.4" height="6.4" rx="1.6" fill="#AFA3FF" />
      <rect x="13.9" y="11.4" width="6.4" height="6.4" rx="1.6" fill="#7FB2FF" />
      <path d="M7 8.5h0M17.1 13.7h0" stroke="#141414" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11 8.6h3.2l-1.4-1.6M13.8 15.4h-3.2l1.4 1.6" stroke="#F35757" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function BugMatchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="7.6" stroke="#141414" strokeWidth="1.4" />
      <path d="M12 3.4v3.1M12 17.5v3.1M3.4 12h3.1M17.5 12h3.1" stroke="#141414" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="4.2" fill="#F35757" />
      <path d="M10.1 9.8h3.8M12 9.8v4.4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="10.8" cy="13.2" r="0.5" fill="#fff" />
      <circle cx="13.2" cy="13.2" r="0.5" fill="#fff" />
    </IconBase>
  );
}

function StudyTableIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.4" y="5" width="17.2" height="14" rx="2.5" fill="#A6BE59" />
      <path d="M3.4 9h17.2M9.2 5v14M14.8 5v14" stroke="#141414" strokeOpacity="0.72" strokeWidth="1.2" />
      <rect x="4.8" y="6.3" width="3.1" height="1.4" rx="0.6" fill="#141414" fillOpacity="0.75" />
      <rect x="10.5" y="10.5" width="3.1" height="1.4" rx="0.6" fill="#141414" fillOpacity="0.75" />
      <rect x="16.1" y="14.7" width="3.1" height="1.4" rx="0.6" fill="#141414" fillOpacity="0.75" />
    </IconBase>
  );
}

function ChoppedIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="13" r="7.2" fill="#F2995E" />
      <path d="M9.2 5.8h5.6M10.2 3.8h3.6v2" stroke="#141414" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 13V9.2M12 13l2.8 1.8" stroke="#141414" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="13" r="1" fill="#141414" />
    </IconBase>
  );
}

function ChatBotIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 5.5h12a2 2 0 012 2v6.8a2 2 0 01-2 2H11.5L8 19.7v-3.4H6a2 2 0 01-2-2V7.5a2 2 0 012-2z" fill="#7FB2FF" />
      <rect x="8.2" y="8.7" width="7.6" height="4.6" rx="1.3" fill="#141414" />
      <circle cx="10.4" cy="11" r="0.8" fill="#fff" />
      <circle cx="13.6" cy="11" r="0.8" fill="#fff" />
      <path d="M9.4 15.3h5.2" stroke="#141414" strokeWidth="1.1" strokeLinecap="round" />
    </IconBase>
  );
}

type GameTypeIconProps = Omit<IconProps, 'children'> & { type: GameType };

export function GameTypeIcon({ type, ...props }: GameTypeIconProps) {
  if (type === GameType.Flashcards) return <FlashcardsIcon {...props} />;
  if (type === GameType.Matching) return <MatchingIcon {...props} />;
  if (type === GameType.Quiz) return <QuizIcon {...props} />;
  if (type === GameType.TypeIn) return <TypeInIcon {...props} />;
  if (type === GameType.HungryBug) return <HungryBugIcon {...props} />;
  if (type === GameType.Crossword) return <CrosswordIcon {...props} />;
  if (type === GameType.Test) return <TestModeIcon {...props} />;
  if (type === GameType.Snowman) return <SnowmanIcon {...props} />;
  if (type === GameType.Unscramble) return <UnscrambleIcon {...props} />;
  if (type === GameType.BugMatch) return <BugMatchIcon {...props} />;
  if (type === GameType.StudyTable) return <StudyTableIcon {...props} />;
  if (type === GameType.Chopped) return <ChoppedIcon {...props} />;
  return <ChatBotIcon {...props} />;
}

const SNACK_COLORS = [
  ['#AFA3FF', '#7FB2FF'],
  ['#F2995E', '#ECD227'],
  ['#F35757', '#F2995E'],
  ['#A6BE59', '#ECD227'],
  ['#EC683E', '#F2995E'],
  ['#7FB2FF', '#A6BE59'],
  ['#F35757', '#AFA3FF'],
  ['#ECD227', '#A6BE59'],
] as const;

type VariantIconProps = Omit<IconProps, 'children'> & { variant?: number };

export function SnackIcon({ variant = 0, ...props }: VariantIconProps) {
  const index = Math.abs(variant) % SNACK_COLORS.length;
  const [primary, secondary] = SNACK_COLORS[index];

  return (
    <IconBase {...props}>
      <ellipse cx="12" cy="14" rx="6" ry="5" fill={primary} />
      <circle cx="10.2" cy="12.8" r="1.05" fill={secondary} />
      <circle cx="13.8" cy="15.1" r="0.9" fill={secondary} />
      <path d="M12 9.2V6.6M12 6.6c1.8 0 3.1-.6 3.9-1.8" stroke="#141414" strokeWidth="1.15" strokeLinecap="round" />
    </IconBase>
  );
}

const ANT_COLORS = ['#F35757', '#7FB2FF', '#AFA3FF', '#A6BE59'] as const;

export function AntIcon({ variant = 0, ...props }: VariantIconProps) {
  const color = ANT_COLORS[Math.abs(variant) % ANT_COLORS.length];
  const eye = Math.abs(variant) % 2 === 0 ? '#fff' : '#141414';

  return (
    <IconBase {...props}>
      <ellipse cx="12" cy="15.1" rx="4.6" ry="3.8" fill={color} />
      <circle cx="12" cy="10" r="3.3" fill={color} />
      <circle cx="10.8" cy="9.7" r="0.6" fill={eye} />
      <circle cx="13.2" cy="9.7" r="0.6" fill={eye} />
      <path d="M10.3 6.9L8.8 5.2M13.7 6.9l1.5-1.7M7.6 14.3l-2-1.3M16.4 14.3l2-1.3M7.6 16.8l-2 1.3M16.4 16.8l2 1.3" stroke="#141414" strokeWidth="1.1" strokeLinecap="round" />
    </IconBase>
  );
}

export function LadybugIcon({ active = true, ...props }: Omit<IconProps, 'children'> & { active?: boolean }) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="13" r="6" fill={active ? '#F35757' : 'rgba(127, 127, 127, 0.35)'} />
      <circle cx="12" cy="8" r="2.5" fill={active ? '#141414' : 'rgba(127, 127, 127, 0.65)'} />
      <path d="M12 7v12M8.4 12.6h0M15.6 12.6h0M9.3 15.9h0M14.7 15.9h0" stroke={active ? '#141414' : 'rgba(127, 127, 127, 0.85)'} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10.5 6.2L9.4 4.8M13.5 6.2l1.1-1.4" stroke={active ? '#141414' : 'rgba(127, 127, 127, 0.85)'} strokeWidth="1" strokeLinecap="round" />
    </IconBase>
  );
}

export function CaterpillarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="8" cy="14" r="2.8" fill="#A6BE59" />
      <circle cx="12" cy="13.5" r="3" fill="#A6BE59" />
      <circle cx="16" cy="13" r="3.2" fill="#ECD227" />
      <circle cx="16.8" cy="12.8" r="0.45" fill="#141414" />
      <path d="M15.5 10.2l1-1.4M17.6 10.3l1-1.6" stroke="#141414" strokeWidth="1.05" strokeLinecap="round" />
    </IconBase>
  );
}
