import { authkitProxy } from '@workos-inc/authkit-nextjs';

export default authkitProxy({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ['/', '/login', '/sign-in', '/signin', '/sign-up', '/signup', '/register'],
  },
});

// Exclude static assets to prevent CSS/image breakage
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
