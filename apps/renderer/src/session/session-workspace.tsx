import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createAppRouter } from "../router";
import { githubSession } from "./github-session-store";

export function SessionWorkspace() {
  const [client] = useState(() => new QueryClient());
  const [router] = useState(createAppRouter);
  const [generation] = useState(() => githubSession.getSnapshot().generation);
  useEffect(() => () => {
    if (githubSession.getSnapshot().generation !== generation) client.clear();
  }, [client, generation]);
  return <QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>;
}
