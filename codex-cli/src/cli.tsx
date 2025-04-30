import "dotenv/config";
import type { AppRollout } from "./app.js";
import { AutoApprovalMode } from "./approvals.js";
export type ApprovalPolicy = AutoApprovalMode;
import type { CommandConfirmation } from "./utils/agent/agent-loop.js";
import type { AppConfig } from "./utils/config.js";
import meow from "meow";
import App from "./app.js";
// Hack to suppress deprecation warnings (punycode)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(process as any).noDeprecation = true;

import { runSinglePass } from "./cli-singlepass.js";
import { AgentLoop } from "./utils/agent/agent-loop.js";
import { ReviewDecision } from "./utils/agent/review.js";
import { AutoApprovalMode as AutoApprovalModeUtil } from "./utils/auto-approval-mode.js";
import { checkForUpdates } from "./utils/check-updates.js";
import { getApiKey, loadConfig, PRETTY_PRINT, INSTRUCTIONS_FILEPATH } from "./utils/config.js";
import { createInputItem } from "./utils/input-utils.js";
import { initLogger } from "./utils/logger/log.js";
import { isModelSupportedForResponses } from "./utils/model-utils.js";
import { parseToolCall } from "./utils/parsers.js";
import { onExit, setInkRenderer } from "./utils/terminal.js";
import chalk from "chalk";
import { spawnSync } from "child_process";
import fs from "fs";
import { render } from "ink";
import { ReasoningEffort } from "openai/resources.mjs";

const cli = meow(
  `
  Usage
    $ codex [options] <prompt>
    $ codex completion <bash|zsh|fish>

  Options
    --version                       Print version and exit

    -h, --help                      Show usage and exit
    -m, --model <model>             Model to use for completions (default: o4-mini)
    -p, --provider <provider>       Provider to use for completions (default: openai)
    -i, --image <path>              Path(s) to image files to include as input
    -v, --view <rollout>            Inspect a previously saved rollout instead of starting a session
    -q, --quiet                     Non-interactive mode that only prints the assistant's final output
    -c, --config                    Open the instructions file in your editor
    -w, --writable-root <path>      Writable folder for sandbox in full-auto mode (can be specified multiple times)
    -a, --approval-mode <mode>      Override the approval policy: 'suggest', 'auto-edit', or 'full-auto'

    --auto-edit                Automatically approve file edits; still prompt for commands
    --full-auto                Automatically approve edits and commands when executed in the sandbox

    --no-project-doc           Do not automatically include the repository's 'codex.md'
    --project-doc <file>       Include an additional markdown file at <file> as context
    --full-stdout              Do not truncate stdout/stderr from command outputs
    --notify                   Enable desktop notifications for responses

    --disable-response-storage Disable server‑side response storage (sends the
                              full conversation context with every request)

    --flex-mode               Use "flex-mode" processing mode for the request (only supported
                              with models o3 and o4-mini)

  Dangerous options
    --dangerously-auto-approve-everything
                              Skip all confirmation prompts and execute commands without
                              sandboxing. Intended solely for ephemeral local testing.

  Experimental options
    -f, --full-context         Launch in "full-context" mode which loads the entire repository
                              into context and applies a batch of edits in one go. Incompatible
                              with all other flags, except for --model.

  Examples
    $ codex "Write and run a python program that prints ASCII art"
    $ codex -q "fix build issues"
    $ codex completion bash
  `,
  {
    importMeta: import.meta,
    autoHelp: true,
    flags: {
      help: { type: "boolean", aliases: ["h"] },
      version: { type: "boolean", description: "Print version and exit" },
      view: { type: "string" },
      model: { type: "string", aliases: ["m"] },
      provider: { type: "string", aliases: ["p"] },
      image: { type: "string", isMultiple: true, aliases: ["i"] },
      quiet: {
        type: "boolean",
        aliases: ["q"],
        description: "Non-interactive quiet mode",
      },
      config: {
        type: "boolean",
        aliases: ["c"],
        description: "Open the instructions file in your editor",
      },
      dangerouslyAutoApproveEverything: {
        type: "boolean",
        description:
          "Automatically approve all commands without prompting. This is EXTREMELY DANGEROUS and should only be used in trusted environments.",
      },
      autoEdit: {
        type: "boolean",
        description: "Automatically approve edits; prompt for commands.",
      },
      fullAuto: {
        type: "boolean",
        description:
          "Automatically run commands in a sandbox; only prompt for failures.",
      },
      approvalMode: {
        type: "string",
        aliases: ["a"],
        description:
          "Determine the approval mode for Codex (default: suggest) Values: suggest, auto-edit, full-auto",
      },
      writableRoot: {
        type: "string",
        isMultiple: true,
        aliases: ["w"],
        description:
          "Writable folder for sandbox in full-auto mode (can be specified multiple times)",
      },
      noProjectDoc: {
        type: "boolean",
        description: "Disable automatic inclusion of project-level codex.md",
      },
      projectDoc: {
        type: "string",
        description: "Path to a markdown file to include as project doc",
      },
      flexMode: {
        type: "boolean",
        description:
          "Enable the flex-mode service tier (only supported by models o3 and o4-mini)",
      },
      fullStdout: {
        type: "boolean",
        description:
          "Disable truncation of stdout/stderr from command outputs (show everything)",
        aliases: ["no-truncate"],
      },
      reasoning: {
        type: "string",
        description: "Set the reasoning effort level (low, medium, high)",
        choices: ["low", "medium", "high"],
        default: "high",
      },
      notify: {
        type: "boolean",
        description: "Enable desktop notifications for responses",
      },
      disableResponseStorage: {
        type: "boolean",
        description:
          "Disable server-side response storage (sends full conversation context with every request)",
      },
      fullContext: {
        type: "boolean",
        aliases: ["f"],
        description: `Run in full-context editing approach. The model is given the whole code
          directory as context and performs changes in one go without acting.`,
      },
    },
  },
);

(async () => {
  const { render: inkRender } = await import("ink");

  const { runSinglePass } = await import("./cli-singlepass.js");
  const { AgentLoop } = await import("./utils/agent/agent-loop.js");
  const { ReviewDecision } = await import("./utils/agent/review.js");
  const { AutoApprovalMode } = await import("./utils/auto-approval-mode.js");
  const { checkForUpdates } = await import("./utils/check-updates.js");
  const { getApiKey, loadConfig, INSTRUCTIONS_FILEPATH } = await import("./utils/config.js");
  const { createInputItem } = await import("./utils/input-utils.js");
  const { isModelSupportedForResponses } = await import("./utils/model-utils.js");
  const { onExit, setInkRenderer } = await import("./utils/terminal.js");
  const { spawnSync } = await import("child_process");
  const fs = await import("fs");
  const path = await import("path");
  const React = await import("react");

  // ---------------------------------------------------------------------------
  // Global flag handling
  // ---------------------------------------------------------------------------

  // Handle 'completion' subcommand before any prompting or API calls
  if (cli.input[0] === "completion") {
    const shell = cli.input[1] || "bash";
    const scripts: Record<string, string> = {
      bash: `# bash completion for codex
_codex_completion() {
  local cur
  cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=( $(compgen -o default -o filenames -- "\${cur}") )
}
complete -F _codex_completion codex`,
      zsh: `# zsh completion for codex
#compdef codex

_codex() {
  _arguments '*:filename:_files'
}
_codex`,
      fish: `# fish completion for codex
complete -c codex -a '(__fish_complete_path)' -d 'file path'`,
    };
    const script = scripts[shell];
    if (!script) {
      // eslint-disable-next-line no-console
      console.error(`Unsupported shell: ${shell}`);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(script);
    process.exit(0);
  }

  // For --help, show help and exit.
  if (cli.flags.help) {
    cli.showHelp();
  }

  // For --config, open custom instructions file in editor and exit.
  if (cli.flags.config) {
    try {
      await loadConfig(); // Ensures the file is created if it doesn't already exit.
    } catch {
      // ignore errors
    }

    const filePath = INSTRUCTIONS_FILEPATH;
    const editor =
      process.env["EDITOR"] || (process.platform === "win32" ? "notepad" : "vi");
    await spawnSync(editor, [filePath], { stdio: "inherit" });
    process.exit(0);
  }

  // ---------------------------------------------------------------------------
  // API key handling
  // ---------------------------------------------------------------------------

  const fullContextMode = Boolean(cli.flags.fullContext);
  let config = await loadConfig(undefined, undefined, {
    cwd: process.cwd(),
    disableProjectDoc: Boolean(cli.flags.noProjectDoc),
    projectDocPath: cli.flags.projectDoc,
    isFullContext: fullContextMode,
  });

  const prompt = cli.input[0];
  const model = cli.flags.model ?? config.model;
  const imagePaths = cli.flags.image;
  const provider = cli.flags.provider ?? config.provider ?? "openai";
  const apiKey = await getApiKey(provider);

  const NO_API_KEY_REQUIRED = new Set(["ollama"]);

  if (!apiKey && !NO_API_KEY_REQUIRED.has(provider.toLowerCase())) {
    // console.error(
    //   `\n${chalk.red(`Missing ${provider} API key.`)}\n\n` +
    //     `Set the environment variable ${chalk.bold(
    //       `${provider.toUpperCase()}_API_KEY`,
    //     )} ` +
    //     `and re-run this command.\n` +
    //     `${
    //       provider.toLowerCase() === "openai"
    //         ? `You can create a key here: ${chalk.bold(
    //             chalk.underline("https://platform.openai.com/account/api-keys"),
    //           )}\n`
    //         : `You can create a ${chalk.bold(
    //             `${provider.toUpperCase()}_API_KEY`,
    //           )} ` + `in the ${chalk.bold(`${provider}`)} dashboard.\n`
    //     }`,
    // );
    // Use logger or handle error appropriately
    process.exit(1);
  }

  const flagPresent = Object.hasOwn(cli.flags, "disableResponseStorage");

  const disableResponseStorage = flagPresent
    ? Boolean(cli.flags.disableResponseStorage) // value user actually passed
    : (config.disableResponseStorage ?? false); // fall back to YAML, default to false

  config = {
    apiKey,
    ...config,
    model: model ?? config.model,
    notify: Boolean(cli.flags.notify),
    reasoningEffort:
      (cli.flags.reasoning as ReasoningEffort | undefined) ?? "high",
    flexMode: Boolean(cli.flags.flexMode),
    provider,
    disableResponseStorage,
  };

  try {
    await checkForUpdates();
  } catch {
    // ignore
  }

  if (cli.flags.flexMode) {
    const allowedFlexModels = new Set(["o3", "o4-mini"]);
    if (!allowedFlexModels.has(config.model)) {
      // console.error(
      //   `The --flex-mode option is only supported when using the 'o3' or 'o4-mini' models. ` +
      //     `Current model: '${config.model}'.`,
      // );
      // Use logger or handle error appropriately
      process.exit(1);
    }
  }

  if (
    !(await isModelSupportedForResponses(provider, config.model)) &&
    (!provider || provider.toLowerCase() === "openai")
  ) {
    // console.error(
    //   `The model "${config.model}" does not appear in the list of models ` +
    //     `available to your account. Double-check the spelling (use\n` +
    //     `  openai models list\n` +
    //     `to see the full list) or choose another model with the --model flag.`,
    // );
    // Use logger or handle error appropriately
    process.exit(1);
  }

  let rollout: AppRollout | undefined;

  if (cli.flags.view) {
    const viewPath = cli.flags.view;
    const absolutePath = path.isAbsolute(viewPath)
      ? viewPath
      : path.join(process.cwd(), viewPath);
    try {
      const content = await fs.promises.readFile(absolutePath, "utf-8");
      rollout = JSON.parse(content) as AppRollout;
    } catch (error) {
      // console.error("Error reading rollout file:", error); // Use logger or handle error appropriately
      process.exit(1);
    }
  }

  if (fullContextMode) {
    await runSinglePass({
      originalPrompt: prompt,
      config,
      rootPath: process.cwd(),
    });
    await onExit();
    process.exit(0);
  }

  const additionalWritableRoots: ReadonlyArray<string> = (
    cli.flags.writableRoot ?? []
  ).map((p) => path.resolve(p));

  if (cli.flags.quiet) {
    process.env["CODEX_QUIET_MODE"] = "1";
    if (!prompt || prompt.trim() === "") {
      // console.error(
      //   'Quiet mode requires a prompt string, e.g.,: codex -q "Fix bug #123 in the foobar project"',
      // );
      // Use logger or handle error appropriately
      process.exit(1);
    }

    const quietApprovalPolicy: ApprovalPolicy =
      cli.flags.fullAuto || cli.flags.approvalMode === "full-auto"
        ? AutoApprovalMode.FULL_AUTO
        : cli.flags.autoEdit || cli.flags.approvalMode === "auto-edit"
        ? AutoApprovalMode.AUTO_EDIT
        : config.approvalMode || AutoApprovalMode.SUGGEST;

    await runQuietMode({
      prompt,
      imagePaths: imagePaths || [],
      approvalPolicy: quietApprovalPolicy,
      additionalWritableRoots,
      config,
    });
    await onExit();
    process.exit(0);
  }

  const approvalPolicy: ApprovalPolicy =
    cli.flags.fullAuto || cli.flags.approvalMode === "full-auto"
      ? AutoApprovalMode.FULL_AUTO
      : cli.flags.autoEdit || cli.flags.approvalMode === "auto-edit"
      ? AutoApprovalMode.AUTO_EDIT
      : config.approvalMode || AutoApprovalMode.SUGGEST;

  const instance = inkRender(
    React.createElement(App, {
      prompt,
      config,
      rollout,
      imagePaths,
      approvalPolicy,
      additionalWritableRoots,
      fullStdout: Boolean(cli.flags.fullStdout),
    }),
    {
      patchConsole: process.env["DEBUG"] ? false : true,
    },
  );
  await setInkRenderer(instance);

  async function runQuietMode({
    prompt,
    imagePaths,
    approvalPolicy,
    additionalWritableRoots,
    config,
  }: {
    prompt: string;
    imagePaths: Array<string>;
    approvalPolicy: ApprovalPolicy;
    additionalWritableRoots: ReadonlyArray<string>;
    config: AppConfig;
  }): Promise<void> {
    const agent = new AgentLoop({
      model: config.model,
      config: config,
      instructions: config.instructions,
      provider: config.provider,
      approvalPolicy,
      additionalWritableRoots,
      disableResponseStorage: config.disableResponseStorage,
      onItem: () => {
        // Removed unused 'item' variable
      },
      onLoading: () => {
        /* intentionally ignored in quiet mode */
      },
      getCommandConfirmation: (
        _command: Array<string>,
      ): Promise<CommandConfirmation> => {
        const reviewDecision =
          approvalPolicy === AutoApprovalMode.FULL_AUTO
            ? ReviewDecision.YES
            : ReviewDecision.NO_CONTINUE;
        return Promise.resolve({ review: reviewDecision });
      },
      onLastResponseId: () => {
        /* intentionally ignored in quiet mode */
      },
    });

    const inputItem = await createInputItem(prompt, imagePaths);
    await agent.run([inputItem]);
  }

  const exit = () => {
    onExit();
    process.exit(0);
  };

  process.on("SIGINT", exit);
  process.on("SIGQUIT", exit);
  process.on("SIGTERM", exit);

  // ---------------------------------------------------------------------------
  // Fallback for Ctrl-C when stdin is in raw-mode
  // ---------------------------------------------------------------------------

  if (process.stdin.isTTY) {
    // Ensure we do not leave the terminal in raw mode if the user presses
    // Ctrl-C while some other component has focus and Ink is intercepting
    // input. Node does *not* emit a SIGINT in raw-mode, so we listen for the
    // corresponding byte (0x03) ourselves and trigger a graceful shutdown.
    const onRawData = (data: Buffer | string): void => {
      const str = Buffer.isBuffer(data) ? data.toString("utf8") : data;
      if (str === "\u0003") {
        exit();
      }
    };
    process.stdin.on("data", onRawData);
  }

  // Ensure terminal clean-up always runs, even when other code calls
  // `process.exit()` directly.
  process.once("exit", onExit);
})();
