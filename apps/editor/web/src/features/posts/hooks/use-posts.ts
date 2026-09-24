import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "../api";
import { POSTS_QUERY_KEY } from "../constants";

export function usePosts() {
  return useQuery({ queryKey: POSTS_QUERY_KEY, queryFn: fetchPosts });
}
