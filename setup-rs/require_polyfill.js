globalThis.require = async (modulePath) => {
  console.log(`Requiring module: ${modulePath}`);

  const nodeModules = ["fs", "path", "util", "child_process", "os", "events", "buffer"];
  const stdNodeBase = "https://deno.land/std@0.206.0/node/";

  // Handle Node.js standard modules
  if (nodeModules.includes(modulePath)) {
    const moduleUrl = `${stdNodeBase}${modulePath}.ts`;
    console.log(`Using std/node module for: ${modulePath} (URL: ${moduleUrl})`);
    try {
      const module = await import(moduleUrl);
      return module;
    } catch (err) {
      console.error(`Failed to import std/node module: ${modulePath}`, err);
      throw new Error(`Node.js module not found: ${modulePath}`);
    }
  }

  // Normalize path and dynamically import embedded modules
  let normalizedPath = modulePath.startsWith("./") || modulePath.startsWith("../")
    ? modulePath.replace(/^\.\//, "") // Remove leading "./" for embedded file lookup
    : modulePath;

  if (!normalizedPath.endsWith(".js")) {
    normalizedPath += ".js";
  }

  console.log(`Normalized path: ${normalizedPath}`);

  try {
    const module = await import(`file:///${normalizedPath}`);
    return module;
  } catch (err) {
    console.error(`Failed to import module: ${normalizedPath}`, err);
    throw new Error(`Module not found: ${modulePath}`);
  }
};
