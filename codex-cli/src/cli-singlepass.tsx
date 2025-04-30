import type { AppConfig } from "./utils/config.js";

import { SinglePassApp } from "./components/singlepass-cli-app.js";
import { render } from "ink";

export async function runSinglePass({
  originalPrompt,
  config,
  rootPath,
}: {
  originalPrompt?: string;
  config: AppConfig;
  rootPath: string;
}): Promise<void> {
  return new Promise((resolve) => {
    render(
      <SinglePassApp
        originalPrompt={originalPrompt}
        config={config}
        rootPath={rootPath}
        onExit={() => resolve()}
      />,
    );
  });
}

export default {};
