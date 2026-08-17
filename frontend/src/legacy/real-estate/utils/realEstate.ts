// @ts-nocheck
export interface PlannedUnitMixEntry {
  id: string;
  type: string;
  label: string;
  count: number;
  bedrooms: number;
  bathrooms: number;
  default_rent: number;
  notes: string;
}

export interface InspectionSectionTemplate {
  section: string;
  items: string[];
}

const DEFAULT_STANDARD_ITEMS = [
  'Door & Locks',
  'Windows',
  'Walls & Paint',
  'Floor Finish',
  'Ceiling',
  'Lighting',
  'Sockets & Switches',
];

const DEFAULT_BEDROOM_ITEMS = [
  ...DEFAULT_STANDARD_ITEMS,
  'Wardrobe / Closets',
  'Curtain Rails',
];

const DEFAULT_KITCHEN_ITEMS = [
  'Door & Locks',
  'Windows',
  'Walls & Paint',
  'Floor Finish',
  'Ceiling',
  'Lighting',
  'Sockets & Switches',
  'Sink & Faucets',
  'Cabinets',
  'Countertops',
  'Backsplash',
];

const DEFAULT_BATHROOM_ITEMS = [
  'Door & Locks',
  'Walls & Paint / Tiles',
  'Floor Finish',
  'Ceiling',
  'Lighting',
  'Wash Basin / Sink',
  'Toilet Bowl & Seat',
  'Flush System',
  'Shower Rose & Mixer',
  'Drainage',
  'Mirror & Accessories',
];

const UNIT_TYPE_LABELS: Record<string, string> = {
  studio: 'Studio / Bedsitter',
  single_room: 'Single Room',
  '1BR': '1 Bedroom',
  '2BR': '2 Bedroom',
  '3BR': '3 Bedroom',
  '4BR': '4 Bedroom',
  '5BR': '5 Bedroom',
  '6BR': '6 Bedroom',
  penthouse: 'Penthouse',
  commercial: 'Commercial Space',
  office: 'Office Suite',
  shop: 'Shop / Retail',
};

const slug = () =>
  Math.random().toString(36).slice(2, 10);

export function getUnitTypeLabel(type: string): string {
  return UNIT_TYPE_LABELS[type] || type || 'Unit';
}

export function normalizePlannedUnitMix(raw: unknown): PlannedUnitMixEntry[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      const value = (entry ?? {}) as Record<string, unknown>;
      return {
        id: String(value.id || slug()),
        type: String(value.type || '1BR'),
        label: String(value.label || ''),
        count: Number(value.count || 0),
        bedrooms: Number(value.bedrooms || 0),
        bathrooms: Number(value.bathrooms || 0),
        default_rent: Number(value.default_rent || 0),
        notes: String(value.notes || ''),
      };
    })
    .filter((entry) => entry.count > 0 || entry.label || entry.notes);
}

export function createEmptyPlannedUnitMixEntry(
  overrides: Partial<PlannedUnitMixEntry> = {}
): PlannedUnitMixEntry {
  return {
    id: slug(),
    type: overrides.type || '1BR',
    label: overrides.label || '',
    count: overrides.count ?? 1,
    bedrooms: overrides.bedrooms ?? 1,
    bathrooms: overrides.bathrooms ?? 1,
    default_rent: overrides.default_rent ?? 0,
    notes: overrides.notes || '',
  };
}

export function calculatePlannedUnitTotals(entries: PlannedUnitMixEntry[]) {
  return entries.reduce(
    (acc, entry) => {
      acc.totalUnits += entry.count || 0;
      acc.totalBedrooms += (entry.count || 0) * (entry.bedrooms || 0);
      acc.totalBathrooms += (entry.count || 0) * (entry.bathrooms || 0);
      return acc;
    },
    { totalUnits: 0, totalBedrooms: 0, totalBathrooms: 0 }
  );
}

function addSection(
  sections: InspectionSectionTemplate[],
  section: string,
  items: string[]
) {
  const existing = sections.find((entry) => entry.section === section);
  if (!existing) {
    sections.push({ section, items: [...new Set(items)] });
    return;
  }

  existing.items = [...new Set([...existing.items, ...items])];
}

export function createInspectionTemplateFromUnitContext(options: {
  type?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  features?: string | null;
  propertyConfig?: unknown;
}): InspectionSectionTemplate[] {
  const sections: InspectionSectionTemplate[] = [];
  const bedrooms = Math.max(0, Number(options.bedrooms || 0));
  const bathrooms = Math.max(0, Number(options.bathrooms || 0));
  const type = String(options.type || '').toLowerCase();
  const featureText = String(options.features || '').toLowerCase();

  if (Array.isArray(options.propertyConfig) && options.propertyConfig.length > 0) {
    options.propertyConfig.forEach((entry) => {
      const value = entry as Record<string, unknown>;
      addSection(
        sections,
        String(value.section || value.name || 'General'),
        Array.isArray(value.items) ? value.items.map(String) : []
      );
    });
  }

  const isStudioLike = type === 'studio' || type === 'single_room';
  addSection(
    sections,
    isStudioLike ? 'Main Room' : 'Living Room',
    DEFAULT_STANDARD_ITEMS
  );

  const bedroomCount = isStudioLike ? Math.max(bedrooms, 0) : Math.max(bedrooms, 1);
  for (let index = 0; index < bedroomCount; index += 1) {
    addSection(sections, `Bedroom ${index + 1}`, DEFAULT_BEDROOM_ITEMS);
  }

  if (!['shop', 'commercial'].includes(type)) {
    addSection(sections, 'Kitchen', DEFAULT_KITCHEN_ITEMS);
  }

  const bathroomCount = Math.max(bathrooms, 1);
  for (let index = 0; index < bathroomCount; index += 1) {
    addSection(sections, bathroomCount === 1 ? 'Bathroom' : `Bathroom ${index + 1}`, DEFAULT_BATHROOM_ITEMS);
  }

  if (featureText.includes('balcony')) {
    addSection(sections, 'Balcony', ['Floor Finish', 'Drainage', 'Railings', 'Walls & Paint']);
  }

  if (featureText.includes('laundry') || featureText.includes('washing area')) {
    addSection(sections, 'Laundry Area', ['Sink & Faucets', 'Drainage', 'Walls & Paint', 'Floor Finish']);
  }

  return sections;
}

export function createInspectionTemplateFromUnitMix(
  entries: PlannedUnitMixEntry[]
): InspectionSectionTemplate[] {
  if (entries.length === 0) {
    return createInspectionTemplateFromUnitContext({});
  }

  return entries.reduce<InspectionSectionTemplate[]>((acc, entry) => {
    const generated = createInspectionTemplateFromUnitContext({
      type: entry.type,
      bedrooms: entry.bedrooms,
      bathrooms: entry.bathrooms,
      features: entry.notes,
    });

    generated.forEach((section) => addSection(acc, section.section, section.items));
    return acc;
  }, []);
}

export function buildScopedCacheKey(base: string, scope?: string | null): string {
  return scope ? `${base}_${scope}` : base;
}
