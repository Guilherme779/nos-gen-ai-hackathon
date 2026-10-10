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

- Use TanStack routes as React frontend entry points and keep teammate API access in src/lib/api.ts; this separates the hosted frontend from the independently owned engine.
- Use source-native XFileButton for Untrace controls; this preserves the supplied CSS and centralizes transform-only Framer Motion interactions.
- Keep upload and result helpers pure and typed, validating downloads before display; this prevents fabricated metadata, Unicode offset drift and altered engine output.
- Keep comparator layers identically structured and change clipping directly with range/pointer input; this guarantees alignment without animating document content.
- Render successful document review outside motion state wrappers and mount modal/toast portals in document.body after hydration; this prevents document animation and clipped overlays.
- Gate analysis on completed fresh health checks, including retries; cached readiness must not allow overlapping engine requests.
