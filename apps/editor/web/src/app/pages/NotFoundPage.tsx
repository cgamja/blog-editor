import { Link } from "react-router";
import { MESSAGES } from "../../shared/messages";
import { ROUTES } from "../../shared/routes/constants";

export function NotFoundPage() {
  return (
    <main className="app-page">
      <h1 className="page-title">{MESSAGES.notFound.title}</h1>
      <Link to={ROUTES.home}>{MESSAGES.notFound.home}</Link>
    </main>
  );
}
