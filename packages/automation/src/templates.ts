import type { AutomationAction, ConditionGroup, EventType } from "./index";

/**
 * Built-in automation templates. Communities enable these or build unlimited
 * custom automations with the same shape. Marketplace/action/trigger packs plug
 * in through the same registries.
 */
export type AutomationTemplateSeed = {
  key: string;
  name: string;
  description: string;
  trigger: EventType;
  conditions: ConditionGroup;
  actions: AutomationAction[];
};

const emptyGroup: ConditionGroup = { combinator: "AND", conditions: [] };

export const AUTOMATION_TEMPLATES: AutomationTemplateSeed[] = [
  {
    key: "application_approved_onboarding",
    name: "Application approved → onboarding",
    description: "When an application is approved, notify the applicant and kick off onboarding.",
    trigger: "Application.Approved",
    conditions: emptyGroup,
    actions: [
      {
        type: "send_notification",
        config: { title: "Welcome aboard!", body: "Your application was approved.", toActor: true },
      },
      { type: "create_task", config: { title: "Complete orientation" } },
    ],
  },
  {
    key: "training_completed_congrats",
    name: "Training completed → congratulate",
    description: "Congratulate members who complete training.",
    trigger: "Training.Completed",
    conditions: emptyGroup,
    actions: [
      {
        type: "send_notification",
        config: {
          title: "Training complete",
          body: "Great work finishing your training!",
          toActor: true,
        },
      },
    ],
  },
  {
    key: "shift_completed_notify_leadership",
    name: "Shift completed → notify leadership",
    description: "Notify leadership when a shift is completed with logged minutes.",
    trigger: "Shift.Completed",
    conditions: emptyGroup,
    actions: [
      {
        type: "send_notification",
        config: { title: "Shift completed", roleKeys: ["owner", "admin"] },
      },
    ],
  },
  {
    key: "website_published_announce",
    name: "Website published → announce",
    description: "When the public website goes live, notify members.",
    trigger: "Website.Published",
    conditions: emptyGroup,
    actions: [
      { type: "send_notification", config: { title: "Our website is live!", allMembers: true } },
    ],
  },
  {
    key: "announcement_published_notify",
    name: "Announcement published → notify members",
    description: "Fan an announcement out to members through automation.",
    trigger: "Announcement.Published",
    conditions: emptyGroup,
    actions: [
      {
        type: "send_notification",
        config: { title: "New announcement", allMembers: true, fromMetadata: "title" },
      },
    ],
  },
];
