import { describe, expect, it } from "vitest";
import {
  isInstallationCreatedAction,
  isPullRequestCreatedAction,
  parseInstallationWebhookEvent,
  parsePullRequestWebhookEvent,
} from "./githubWebhook";

describe("parsePullRequestWebhookEvent", () => {
  it("maps a pull_request.opened payload into the stored fields", () => {
    const payload = {
      action: "opened",
      repository: {
        name: "deploytitan-console",
        owner: {
          login: "deploytitan",
        },
      },
      pull_request: {
        number: 42,
        title: "Add webhook handling",
        html_url: "https://github.com/deploytitan/deploytitan-console/pull/42",
        state: "open",
        merged: false,
        merged_at: null,
        user: {
          login: "octocat",
        },
        base: {
          ref: "main",
        },
        head: {
          ref: "feature/webhook",
        },
      },
    };

    expect(parsePullRequestWebhookEvent(payload)).toEqual({
      action: "opened",
      number: 42,
      title: "Add webhook handling",
      url: "https://github.com/deploytitan/deploytitan-console/pull/42",
      state: "open",
      merged: false,
      mergedAt: null,
      authorName: "octocat",
      baseBranch: "main",
      headBranch: "feature/webhook",
      repoOwner: "deploytitan",
      repoName: "deploytitan-console",
      defaultBranch: null,
    });
  });

  it("captures repository defaults when present", () => {
    const payload = {
      action: "opened",
      repository: {
        name: "deploytitan-console",
        default_branch: "main",
        owner: {
          login: "deploytitan",
        },
      },
      pull_request: {
        number: 7,
        title: "Sync default branch",
        html_url: "https://github.com/deploytitan/deploytitan-console/pull/7",
        state: "open",
        merged: false,
        merged_at: null,
        user: {
          login: "octocat",
        },
        base: {
          ref: "main",
        },
        head: {
          ref: "feature/default-branch",
        },
      },
    };

    expect(parsePullRequestWebhookEvent(payload).defaultBranch).toBe("main");
  });

  it("rejects malformed webhook payloads", () => {
    const payload = {
      action: "opened",
      repository: {
        name: "deploytitan-console",
      },
      pull_request: {
        number: 42,
      },
    };

    expect(() => parsePullRequestWebhookEvent(payload)).toThrow(
      /Invalid GitHub webhook payload/,
    );
  });
});

describe("isPullRequestCreatedAction", () => {
  it("accepts only newly created pull requests", () => {
    expect(isPullRequestCreatedAction("opened")).toBe(true);
    expect(isPullRequestCreatedAction("closed")).toBe(false);
    expect(isPullRequestCreatedAction("synchronize")).toBe(false);
  });
});

describe("parseInstallationWebhookEvent", () => {
  it("maps an installation.created payload into repository records", () => {
    const payload = {
      action: "created",
      installation: {
        id: 140454738,
        account: {
          login: "deploytitan",
        },
      },
      repositories: [
        {
          name: "deploytitan-console",
          full_name: "deploytitan/deploytitan-console",
          private: false,
        },
        {
          name: "deploytitan-demo",
          private: false,
        },
      ],
    };

    expect(parseInstallationWebhookEvent(payload)).toEqual({
      action: "created",
      installationId: 140454738,
      accountLogin: "deploytitan",
      repositories: [
        {
          repoOwner: "deploytitan",
          repoName: "deploytitan-console",
          isPrivate: false,
        },
        {
          repoOwner: "deploytitan",
          repoName: "deploytitan-demo",
          isPrivate: false,
        },
      ],
    });
  });
});

describe("isInstallationCreatedAction", () => {
  it("accepts only newly created installations", () => {
    expect(isInstallationCreatedAction("created")).toBe(true);
    expect(isInstallationCreatedAction("deleted")).toBe(false);
    expect(isInstallationCreatedAction("new_permissions_accepted")).toBe(false);
  });
});
