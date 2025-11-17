// proxy.ts
import { withAuth } from "next-auth/middleware";

// Middleware di autenticazione
export default withAuth(
  function () {},
  {
    callbacks: {
      authorized: ({ token }) => token != null,
    },
    pages: {
      signIn: "/login",
    },
  }
);

// Rotte protette
export const config = {
  matcher: ["/", "/dashboard/:path*", "/journal/:path*", "/statistics/:path*"],
};
