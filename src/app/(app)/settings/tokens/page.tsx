import SettingsHeader from "@/components/features/settings/SettingsHeader";
import TokenManager from "@/components/features/settings/TokenManager";
import { listTokens } from "@/lib/auth/actions";

export default async function SettingsTokensPage() {
  const tokens = await listTokens();
  return (
    <section>
      <SettingsHeader title="Shortcut-Tokens" />
      <TokenManager initialTokens={tokens} />
    </section>
  );
}
