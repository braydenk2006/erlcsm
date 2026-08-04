export type NotificationChannel = "in_app" | "email" | "discord" | "push";

export type NotificationDraft = {
  organizationId: string;
  userId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  href?: string;
};

export function shouldDeliver(prefs: { enabled: boolean }, draft: NotificationDraft): boolean {
  void draft;
  return prefs.enabled;
}
