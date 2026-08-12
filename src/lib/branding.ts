/**
 * The organisation name shown in the header wordmark and on the sign-in card.
 *
 * Read on the server only, and deliberately *not* a NEXT_PUBLIC_ variable:
 * those are inlined into the bundle at build time, which would bake one
 * company's name into every published image. As a plain server-side variable
 * it stays a deployment setting — the same image serves any organisation, with
 * `ORG_NAME` set in the compose file or the environment.
 *
 * Components that need it in the browser receive it as a prop.
 *
 * The tagline beside it is translated copy and comes from the language files.
 */
export const ORG_NAME = process.env.ORG_NAME?.trim() || "Acme";
