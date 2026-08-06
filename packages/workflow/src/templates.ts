import type { FormSchema } from "./fields";
import type { WorkflowDefinition } from "./workflow";

/**
 * Built-in workflow templates. Applications and Training are NOT separate
 * systems — they are templates on this platform. Communities can also create
 * unlimited custom templates with the same shape.
 */
export type WorkflowTemplateSeed = {
  key: string;
  name: string;
  category: string;
  description: string;
  form: FormSchema;
  workflow: WorkflowDefinition;
};

const application: WorkflowTemplateSeed = {
  key: "staff_application",
  name: "Staff Application",
  category: "application",
  description: "Apply to join the staff team.",
  form: {
    fields: [
      { id: "roblox", type: "short_text", label: "Roblox username", required: true },
      { id: "timezone", type: "short_text", label: "Timezone", required: true },
      { id: "age", type: "number", label: "Age", validation: { min: 13, max: 99 } },
      {
        id: "why",
        type: "long_text",
        label: "Why do you want to join?",
        required: true,
        validation: { minLength: 20 },
      },
      { id: "experience", type: "long_text", label: "Relevant experience" },
    ],
  },
  workflow: {
    initialStageId: "review",
    stages: [
      {
        id: "review",
        name: "Application Review",
        approvalMode: "SINGLE",
        assignment: { strategy: "ROLE", target: "admin" },
        onApprove: "interview",
        allowRevision: true,
      },
      {
        id: "interview",
        name: "Interview",
        approvalMode: "SINGLE",
        assignment: { strategy: "ROLE", target: "admin" },
        onApprove: "COMPLETE",
      },
    ],
  },
};

const leave: WorkflowTemplateSeed = {
  key: "leave_request",
  name: "Leave Request",
  category: "leave",
  description: "Request a leave of absence.",
  form: {
    fields: [
      { id: "start", type: "date", label: "Start date", required: true },
      { id: "end", type: "date", label: "End date", required: true },
      {
        id: "type",
        type: "dropdown",
        label: "Type",
        required: true,
        options: [
          { label: "Vacation", value: "vacation" },
          { label: "Medical", value: "medical" },
          { label: "Personal", value: "personal" },
        ],
      },
      { id: "reason", type: "long_text", label: "Reason", required: true },
    ],
  },
  workflow: {
    initialStageId: "supervisor",
    stages: [
      {
        id: "supervisor",
        name: "Supervisor Review",
        approvalMode: "SINGLE",
        assignment: { strategy: "ROLE", target: "admin" },
        onApprove: "COMPLETE",
        allowRevision: true,
      },
    ],
  },
};

const promotion: WorkflowTemplateSeed = {
  key: "promotion_request",
  name: "Promotion Request",
  category: "promotion",
  description: "Request a promotion.",
  form: {
    fields: [
      { id: "desired_rank", type: "short_text", label: "Desired rank", required: true },
      {
        id: "justification",
        type: "long_text",
        label: "Justification",
        required: true,
        validation: { minLength: 30 },
      },
    ],
  },
  workflow: {
    initialStageId: "board",
    stages: [
      {
        id: "board",
        name: "Board Review",
        approvalMode: "ALL",
        assignment: { strategy: "ROLE", target: "admin" },
        onApprove: "leadership",
      },
      {
        id: "leadership",
        name: "Leadership Approval",
        approvalMode: "SINGLE",
        assignment: { strategy: "ROLE", target: "owner" },
        onApprove: "COMPLETE",
      },
    ],
  },
};

const general: WorkflowTemplateSeed = {
  key: "general_request",
  name: "General Request",
  category: "general",
  description: "Submit a general request.",
  form: {
    fields: [
      { id: "subject", type: "short_text", label: "Subject", required: true },
      { id: "details", type: "long_text", label: "Details", required: true },
    ],
  },
  workflow: {
    initialStageId: "review",
    stages: [
      {
        id: "review",
        name: "Review",
        approvalMode: "SINGLE",
        assignment: { strategy: "ROLE", target: "admin" },
        onApprove: "COMPLETE",
        allowRevision: true,
      },
    ],
  },
};

const training: WorkflowTemplateSeed = {
  key: "training_quiz",
  name: "Onboarding Training",
  category: "training",
  description: "Complete the onboarding training and quiz.",
  form: {
    fields: [
      {
        id: "lesson_ack",
        type: "toggle",
        label: "I have read the onboarding lesson",
        required: true,
      },
      {
        id: "q1",
        type: "radio",
        label: "What do you do first on duty?",
        required: true,
        options: [
          { label: "Start a shift", value: "shift" },
          { label: "Nothing", value: "nothing" },
        ],
      },
      {
        id: "q2",
        type: "radio",
        label: "Who can approve a leave request?",
        required: true,
        options: [
          { label: "A supervisor", value: "supervisor" },
          { label: "Anyone", value: "anyone" },
        ],
      },
    ],
  },
  workflow: {
    initialStageId: "complete",
    stages: [
      {
        id: "complete",
        name: "Completion",
        approvalMode: "AUTO",
        assignment: { strategy: "SUBMITTER" },
        onApprove: "COMPLETE",
      },
    ],
  },
};

export const BUILT_IN_TEMPLATES: WorkflowTemplateSeed[] = [
  application,
  leave,
  promotion,
  general,
  training,
];
