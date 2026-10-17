const doc = "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z";
const folder = "M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z";
const frame = <rect x="3" y="4" width="18" height="16" rx="1" />;

const paths = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  home: <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  escrito: <><path d="M4 4h12l4 4v12H4z" /><path d="M8 13h8M8 17h5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  settings: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  pdf: <><path d={doc} /><path d="M14 3v5h5" /></>,
  addPdf: <><path d={doc} /><path d="M14 3v5h5M12 11v6M9 14h6" /></>,
  folder: <path d={folder} />,
  addFolder: <><path d={folder} /><path d="M12 11v5M9.5 13.5h5" /></>,
  import: <><path d="M12 15V3m0 12-4-4m4 4 4-4" /><path d="M4 17v3h16v-3" /></>,
  export: <><path d="M12 3v12m0-12-4 4m4-4 4 4" /><path d="M4 17v3h16v-3" /></>,
  back: <path d="m15 6-6 6 6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  split: <>{frame}<path d="M12 4v16" /></>,
  openRight: <>{frame}<path d="M12 4v16M15 12h3" /></>,
  panel: <>{frame}<path d="M15 4v16" /></>,
};

export type IconName = keyof typeof paths;

export function Icon({ name, className, strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true" className={className}>
      {paths[name]}
    </svg>
  );
}
