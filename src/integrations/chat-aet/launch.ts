import { supabase } from "../supabase/client";
import { CHAT_AET_URL } from "./index";

/**
 * Starts the Chat AET hand-off using the currently authenticated Stickman
 * Video session. No password or long-lived secret is sent to Chat AET.
 *
 * The Chat AET endpoint must validate the access token server-side before
 * creating or signing in a Chat AET account.
 */
export async function launchChatAet(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    const returnTo = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams({
      chat_aet: "signup",
      return_to: returnTo,
    });
    window.location.href = `${CHAT_AET_URL}?${params.toString()}`;
    return;
  }

  const params = new URLSearchParams({
    token: accessToken,
    return_to: `${window.location.origin}${window.location.pathname}`,
  });

  window.location.href = `${CHAT_AET_URL}?${params.toString()}`;
}
