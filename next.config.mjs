/** @type {import('next').NextConfig} */
const nextConfig = {
  // API routes declare `export const runtime = "nodejs"` individually —
  // the Stripe SDK, pdf-lib and fs all need the Node.js runtime.
  // Extend here (headers, redirects, images) when building on this template.
};

export default nextConfig;