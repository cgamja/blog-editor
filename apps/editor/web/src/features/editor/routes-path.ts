import { ROUTES } from "../../shared/routes/constants";

/** `/posts/:slug/edit`에 주소를 채운다 */
export const editPathOf = (slug: string) =>
  ROUTES.editPost.replace(":slug", encodeURIComponent(slug));
