// Polyfill for Node.js-style `require`
globalThis.require = async (modulePath) => {
  console.log(`Requiring module: ${modulePath}`);

  const nodeModules = ["fs", "path", "util", "child_process", "os", "events", "buffer"];
  const stdNodeBase = "https://deno.land/std@0.206.0/node/";

  // Check if the module is a Node.js module
  if (nodeModules.includes(modulePath)) {
    console.log(`Using std/node module for: ${modulePath}`);
    try {
      const module = await import(`${stdNodeBase}${modulePath}.ts`);
      return module;
    } catch (err) {
      console.error(`Failed to import std/node module: ${modulePath}`, err);
      throw new Error(`Node.js module not found: ${modulePath}`);
    }
  }

  // Normalize the path for embedded file lookup
  let normalizedPath = modulePath.startsWith("./") || modulePath.startsWith("../")
    ? modulePath.replace(/^\.\//, "") // Remove leading "./"
    : modulePath;

  if (!normalizedPath.endsWith(".js")) {
    normalizedPath += ".js"; // Add `.js` if missing
  }

  console.log(`Normalized path: ${normalizedPath}`);

  // Dynamically import the module
  try {
    const module = await import(`file:///${normalizedPath}`);
    return module;
  } catch (err) {
    console.error(`Failed to import embedded module: ${normalizedPath}`, err);
    throw new Error(`Module not found: ${modulePath}`);
  }
};
