import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { imageSources, type MediaLike } from "@/lib/media";

export interface ProjectCardData {
  id: string;
  title: string;
  meta: string;
  visibility: "public" | "password" | "hidden";
  published: boolean;
  cover: MediaLike | null;
}

export function projectBadge(
  p: Pick<ProjectCardData, "visibility" | "published">,
): "live" | "password" | "draft" | "hidden" {
  if (p.visibility === "hidden") return "hidden";
  if (p.visibility === "password") return "password";
  return p.published ? "live" : "draft";
}

/** Dashboard tile: 4:3 thumbnail with a status badge, title, then category · role. */
export function ProjectCard({ p, labels }: { p: ProjectCardData; labels: Record<string, string> }) {
  const badge = projectBadge(p);
  const img = p.cover ? imageSources(p.cover, 600) : null;
  return (
    <a href={`/projects/${p.id}`} className="group flex flex-col gap-2" data-testid="project-card">
      <div className="bg-mist relative aspect-[4/3] overflow-hidden rounded-md">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.src}
            srcSet={img.srcSet}
            sizes="(min-width: 768px) 260px, 50vw"
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="text-muted flex h-full items-center justify-center">
            <Icon name="image" size={40} />
          </span>
        )}
        <span className="absolute start-2.5 top-2.5">
          <Badge variant={badge as BadgeVariant}>{labels[badge]}</Badge>
        </span>
      </div>
      <div className="font-semibold">{p.title}</div>
      {p.meta && <div className="text-muted text-[12px]">{p.meta}</div>}
    </a>
  );
}
