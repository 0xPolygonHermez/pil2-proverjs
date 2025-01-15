// Polyfill for Node.js-style `require`
globalThis.require = async (modulePath) => {
  console.log(`Requiring module: ${modulePath}`);

  // Normalize the path to handle relative imports
  const normalizedPath = modulePath.startsWith("./") || modulePath.startsWith("../")
    ? modulePath
    : `./${modulePath}`;

  console.log(`Normalized path: ${normalizedPath}`);

  // Dynamically import the module, relative to the baked-in `src` directory
  const resolvedPath = normalizedPath.replace(/^(\.\/|\/)/, ""); // Strip leading "./" or "/"
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
