// Polyfill for Node.js-style `require`
globalThis.require = async (modulePath) => {
  console.log(`Requiring module: ${modulePath}`);

  // Normalize the path to handle relative imports
  const normalizedPath = modulePath.startsWith("./") || modulePath.startsWith("../")
    ? modulePath
    : `./${modulePath}`;

  console.log(`Normalized path: ${normalizedPath}`);

  // Construct an absolute specifier relative to `file:///`
  const basePath = "file:///entrypoint.js"; // Default virtual base for resolving
  const resolvedPath = new URL(normalizedPath, basePath).toString();
  console.log(`Resolved path: ${resolvedPath}`);

  try {
    const module = await import(resolvedPath);
    console.log(`Successfully loaded module: ${resolvedPath}`);
    return module;
  } catch (err) {
    console.error(`Failed to load module: ${resolvedPath}`, err);
    throw new Error(`Module not found: ${modulePath}`);
  }
};
