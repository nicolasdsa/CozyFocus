interface RoadmapCard {
  title: string;
  description: string;
  tag: {
    label: string;
    variant: RoadmapTagVariant;
  };
}

type RoadmapTagVariant = "core" | "feature" | "design" | "marketing" | "analytics" | "integration";

interface RoadmapColumn {
  id: "planned" | "progress" | "done";
  title: string;
  cards: RoadmapCard[];
}

const ROADMAP_COLUMNS: RoadmapColumn[] = [
  {
    id: "planned",
    title: "Planned",
    cards: [
      {
        title: "Share streaks to Instagram Stories",
        description:
          "Generate a polished story-ready card so you can share your current streak on Instagram in one tap.",
        tag: {
          label: "Integration",
          variant: "integration"
        }
      },
      {
        title: "Markdown notes editor improvements",
        description:
          "Refine the writing experience with smarter toolbar actions, stronger shortcuts, and a cleaner preview flow.",
        tag: {
          label: "Feature",
          variant: "feature"
        }
      },
      {
        title: "Dynamic and fixed background update",
        description: "Visual and behavior refresh for dynamic and static backgrounds.",
        tag: {
          label: "Design",
          variant: "design"
        }
      },
      {
        title: "Pomodoro extension",
        description: "Companion extension for quick access to focus sessions.",
        tag: {
          label: "Feature",
          variant: "feature"
        }
      }
    ]
  },
  {
    id: "progress",
    title: "In Progress",
    cards: [
      {
        title: "Ambient sounds",
        description:
          "Add and mix ambient options like rain, wind, snow, fire, and similar nature sound layers.",
        tag: {
          label: "Feature",
          variant: "feature"
        }
      }
    ]
  },
  {
    id: "done",
    title: "Done",
    cards: [
      {
        title: "Version 1.0 completed",
        description: "Initial public milestone delivered.",
        tag: {
          label: "Core",
          variant: "core"
        }
      }
    ]
  }
];

const slugifyTitle = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const tagVariantClass = (variant: RoadmapTagVariant): string => {
  return `roadmap-tag--${variant}`;
};

const renderCard = (card: RoadmapCard): string => {
  const titleSlug = slugifyTitle(card.title);
  return `
    <article class="roadmap-card card" data-testid="roadmap-card-${titleSlug}">
      <div class="roadmap-card__tag-row">
        <span
          class="roadmap-tag ${tagVariantClass(card.tag.variant)}"
          data-testid="roadmap-tag-${titleSlug}"
        >
          ${card.tag.label}
        </span>
      </div>
      <h4 class="roadmap-card__title">${card.title}</h4>
      <p class="roadmap-card__description">${card.description}</p>
    </article>
  `;
};

const renderColumn = (column: RoadmapColumn): string => {
  return `
    <section class="roadmap-column" data-testid="roadmap-col-${column.id}">
      <header class="roadmap-column__header">
        <div class="roadmap-column__title-wrap">
          <span
            class="roadmap-col-dot roadmap-col-dot--${column.id}"
            data-testid="roadmap-dot-${column.id}"
            aria-hidden="true"
          ></span>
          <h3 class="roadmap-column__title">${column.title}</h3>
        </div>
        <span class="roadmap-column__count">${column.cards.length}</span>
      </header>
      <div class="roadmap-column__body">
        ${column.cards.map((card) => renderCard(card)).join("")}
      </div>
    </section>
  `;
};

export const mountRoadmapView = (root: HTMLElement): void => {
  root.innerHTML = `
    <section class="roadmap-view" data-testid="roadmap-view">
      <header class="roadmap-header">
        <h2 class="roadmap-title" data-testid="roadmap-title">Product Roadmap</h2>
      </header>
      <div class="roadmap-board" data-testid="roadmap-board">
        ${ROADMAP_COLUMNS.map((column) => renderColumn(column)).join("")}
      </div>
    </section>
  `;
};
