import Link from "next/link";
import Signup from "@/components/signup";

export default function SignupPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return <main className="setup"><h1>Registrierung noch nicht eingerichtet</h1><p>Bitte zuerst Supabase gemäss README konfigurieren.</p><Link href="/">Zur Einrichtung</Link></main>;
  }
  return <Signup />;
}
