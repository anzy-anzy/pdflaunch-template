import type { Metadata } from "next";
import { cookies } from "next/headers";
import AdminDashboard from "./AdminDashboard";
import AdminLoginForm from "./LoginForm";
import { ADMIN_COOKIE, isAdminLocked, verifyAdminToken } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Admin",
};

/**
 * GET /admin
 *
 * Demo mode (ADMIN_PASSWORD unset): renders the dashboard directly — zero
 * config, exactly as before.
 *
 * Locked mode (ADMIN_PASSWORD set): renders the password form unless a valid
 * `pdflaunch_admin` session cookie is present, in which case it renders the
 * dashboard (with the "Sign out" button).
 */
export default async function AdminPage() {
  const cookieStore = await cookies();

  if (isAdminLocked() && !verifyAdminToken(cookieStore.get(ADMIN_COOKIE)?.value)) {
    return <AdminLoginForm />;
  }

  return <AdminDashboard adminLocked={isAdminLocked()} />;
}