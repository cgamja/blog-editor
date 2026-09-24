import { Link } from "react-router";
import { MESSAGES } from "../messages";
import { ROUTES } from "../routes";

export function NotFoundPage() {
  return (
    <main className="app-page">
      <h1>{MESSAGES.notFound.title}</h1>
      <Link to={ROUTES.home}>{MESSAGES.notFound.home}</Link>
    </main>
  );
}
