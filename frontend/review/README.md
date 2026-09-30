# UI review harness

Run `npm run ui:review --workspace frontend` from the repository root. This separate Vite config serves actual Vue page components with local service/auth mocks and synthetic `QA-` fixtures. It never creates a Supabase client or calls a real service.

The entry point lives outside the production Vite root and is not included in the normal build. Use the toolbar to switch among the 13 page components and to inspect normal, empty, loading/error, and slow-loading states.
