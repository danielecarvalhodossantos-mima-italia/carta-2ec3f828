<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Carta architecture
- Access Supabase from browser pages using the generated typed client and existing RLS; no app server layer is needed for these user-requested client flows.
- Keep private restaurant pages under the client-only `_authenticated` layout so sessions are checked before loaders; `/auth` redirects to the public `/login` page for integration compatibility.
- Own the single auth subscription in the root and clear Query caches before sign-out to prevent stale private data.
- Centralize typed restaurant queries and RPC calls in `src/lib/carta.ts` so list and detail reads enforce the same user scope.
