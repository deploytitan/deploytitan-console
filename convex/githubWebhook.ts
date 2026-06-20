type JsonRecord = Record<string, unknown>;

export type PullRequestWebhookEvent = {
  action: string;
  number: number;
  title: string;
  url: string;
  state: string;
  merged: boolean;
  mergedAt: string | null;
  authorName: string | null;
  baseBranch: string;
  headBranch: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string | null;
};

export type InstallationWebhookEvent = {
  action: string;
  installationId: number;
  accountLogin: string;
  repositories: Array<{
    repoOwner: string;
    repoName: string;
    isPrivate: boolean;
  }>;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid GitHub webhook payload: missing ${fieldName}.`);
  }

  return value;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid GitHub webhook payload: missing ${fieldName}.`);
  }

  return value;
}

function readNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid GitHub webhook payload: missing ${fieldName}.`);
  }

  return value;
}

export function parsePullRequestWebhookEvent(
  payload: object,
): PullRequestWebhookEvent {
  if (!isRecord(payload)) {
    throw new Error("Invalid GitHub webhook payload: expected an object.");
  }

  const pullRequest = payload.pull_request;
  const repository = payload.repository;

  if (!isRecord(pullRequest)) {
    throw new Error(
      "Invalid GitHub webhook payload: missing pull_request object.",
    );
  }

  if (!isRecord(repository)) {
    throw new Error(
      "Invalid GitHub webhook payload: missing repository object.",
    );
  }

  const repositoryOwner = repository.owner;
  const base = pullRequest.base;
  const head = pullRequest.head;
  const author = pullRequest.user;

  if (!isRecord(repositoryOwner)) {
    throw new Error("Invalid GitHub webhook payload: missing repository owner.");
  }

  if (!isRecord(base) || !isRecord(head)) {
    throw new Error(
      "Invalid GitHub webhook payload: missing pull request branch refs.",
    );
  }

  return {
    action: readString(payload.action, "action"),
    number: readNumber(pullRequest.number, "pull_request.number"),
    title: readString(pullRequest.title, "pull_request.title"),
    url: readString(pullRequest.html_url, "pull_request.html_url"),
    state: readString(pullRequest.state, "pull_request.state"),
    merged: readBoolean(pullRequest.merged, "pull_request.merged"),
    mergedAt: readOptionalString(pullRequest.merged_at),
    authorName: isRecord(author) ? readOptionalString(author.login) : null,
    baseBranch: readString(base.ref, "pull_request.base.ref"),
    headBranch: readString(head.ref, "pull_request.head.ref"),
    repoOwner: readString(repositoryOwner.login, "repository.owner.login"),
    repoName: readString(repository.name, "repository.name"),
    defaultBranch: readOptionalString(repository.default_branch),
  };
}

export function isPullRequestCreatedAction(action: string): boolean {
  return action === "opened";
}

export function parseInstallationWebhookEvent(
  payload: object,
): InstallationWebhookEvent {
  if (!isRecord(payload)) {
    throw new Error("Invalid GitHub webhook payload: expected an object.");
  }

  const installation = payload.installation;
  const account = isRecord(installation) ? installation.account : null;
  const repositories = payload.repositories;

  if (!isRecord(installation)) {
    throw new Error(
      "Invalid GitHub webhook payload: missing installation object.",
    );
  }

  if (!isRecord(account)) {
    throw new Error(
      "Invalid GitHub webhook payload: missing installation account.",
    );
  }

  if (!Array.isArray(repositories)) {
    throw new Error(
      "Invalid GitHub webhook payload: missing repositories array.",
    );
  }

  return {
    action: readString(payload.action, "action"),
    installationId: readNumber(installation.id, "installation.id"),
    accountLogin: readString(account.login, "installation.account.login"),
    repositories: repositories.map((repository, index) => {
      if (!isRecord(repository)) {
        throw new Error(
          `Invalid GitHub webhook payload: repository at index ${index} is invalid.`,
        );
      }

      const fullName = readOptionalString(repository.full_name);
      const repoName = readString(repository.name, `repositories[${index}].name`);
      const ownerFromFullName =
        fullName && fullName.includes("/") ? fullName.split("/")[0] : null;

      return {
        repoOwner: ownerFromFullName ?? readString(account.login, "installation.account.login"),
        repoName,
        isPrivate: typeof repository.private === "boolean" ? repository.private : false,
      };
    }),
  };
}

export function isInstallationCreatedAction(action: string): boolean {
  return action === "created";
}
