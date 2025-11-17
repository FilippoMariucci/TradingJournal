export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/", "/dashboard/:path*", "/journal/:path*", "/statistics/:path*"],
};
