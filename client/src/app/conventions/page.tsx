import { ConventionsListView } from "./_components/ConventionsListView";

/* Route: /conventions (Conventions Extractor). Thin route entry — the view, the
   cards, the create-skill modal, styles, helpers and i18n are colocated under
   _components. Repo comes from the active-repo context (global, like /skills). */
export default function ConventionsPage() {
  return <ConventionsListView />;
}
