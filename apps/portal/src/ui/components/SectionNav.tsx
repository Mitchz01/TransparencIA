// Jumps between the portal's sections on a long phone page. Stays on top while scrolling.
export interface NavSection {
  id: string
  label: string
}

export function SectionNav({ sections }: { sections: NavSection[] }) {
  return (
    <nav aria-label="Secciones" className="sticky top-[60px] z-20 -mx-4 bg-bg/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8 lg:hidden">
      <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {sections.map((section) => (
          <li key={section.id} className="shrink-0">
            <a
              href={`#${section.id}`}
              className="inline-flex h-control-sm items-center rounded-pill bg-surface px-3 text-label whitespace-nowrap text-ink-muted hover:text-ink"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
