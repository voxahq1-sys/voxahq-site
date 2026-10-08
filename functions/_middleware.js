// VOXA: 301 redirect from the old pages.dev hostname to the custom domain,
// so Google sees a permanent move and visitors land on voxahq.in.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname.endsWith(".pages.dev")) {
    const target = "https://voxahq.in" + url.pathname + url.search;
    return Response.redirect(target, 301);
  }
  return context.next();
}
