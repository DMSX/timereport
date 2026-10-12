import Auth from "@/components/auth";
import Link from "next/link";

export default function Login() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return <main className="setup"><h1>Login noch nicht eingerichtet</h1><p>Bitte zuerst Supabase gemäss README konfigurieren.</p><Link href="/">Zur Einrichtung</Link></main>;
  }
  return <Auth />;
}
