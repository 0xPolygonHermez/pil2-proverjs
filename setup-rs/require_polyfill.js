// Polyfill for Node.js-style `require`
globalThis.require = async (modulePath) => {
  console.log(`Requiring module: ${modulePath}`);

  // Normalize the path and add .js if missing
  let normalizedPath = modulePath.startsWith("./") || modulePath.startsWith("../")
    ? modulePath.replace(/^\.\//, "") // Remove leading "./" for embedded file lookup
    : modulePath;

  if (!normalizedPath.endsWith(".js")) {
    normalizedPath += ".js"; // Add `.js` if missing
  }

  console.log(`Normalized path: ${normalizedPath}`);

  // Dynamically import the module
  try {
    const module = await import(normalizedPath);
    return module;
  } catch (err) {
    throw new Error(`Module not found: ${modulePath}`);
  }
};
